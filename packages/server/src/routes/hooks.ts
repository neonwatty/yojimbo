import { FastifyPluginAsync } from 'fastify';
import { getDb } from '../db/index.js';
import type { InstanceStatus } from '@cc-orchestrator/shared';

interface StatusHookBody {
  instanceId: string;
  status: InstanceStatus;
  message?: string;
  hookType?: 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification';
  toolName?: string;
}

// Track last activity time for idle detection
const lastActivityMap = new Map<string, number>();

// Idle timeout in milliseconds (5 minutes)
const IDLE_TIMEOUT = 5 * 60 * 1000;

export const hookRoutes: FastifyPluginAsync = async (fastify) => {
  // Status update hook - called by Claude Code
  fastify.post<{ Body: StatusHookBody }>('/api/hooks/status', async (request, reply) => {
    const db = getDb();
    const { instanceId, status, message, hookType, toolName } = request.body;

    // Verify instance exists
    const instance = db.prepare('SELECT id, status FROM instances WHERE id = ?').get(instanceId) as
      | { id: string; status: InstanceStatus }
      | undefined;

    if (!instance) {
      return reply.status(404).send({ error: 'Instance not found' });
    }

    // Update last activity time
    lastActivityMap.set(instanceId, Date.now());

    // Determine new status based on hook type
    let newStatus = status;
    if (hookType) {
      switch (hookType) {
        case 'PreToolUse':
          newStatus = 'working';
          break;
        case 'PostToolUse':
          // Stay working unless explicitly set otherwise
          if (!status) newStatus = 'working';
          break;
        case 'Stop':
          newStatus = 'idle';
          break;
        case 'Notification':
          // Notifications might indicate awaiting input
          if (message?.toLowerCase().includes('permission') ||
              message?.toLowerCase().includes('confirm')) {
            newStatus = 'awaiting';
          }
          break;
      }
    }

    // Only update if status changed
    if (instance.status !== newStatus) {
      // Update instance status
      db.prepare(
        `UPDATE instances SET status = ?, last_activity_at = datetime('now') WHERE id = ?`
      ).run(newStatus, instanceId);

      // Insert status event
      db.prepare(
        `INSERT INTO status_events (instance_id, status, message, timestamp)
         VALUES (?, ?, ?, datetime('now'))`
      ).run(instanceId, newStatus, message || `Status changed to ${newStatus}`);

      // Broadcast status change via WebSocket
      const wsServer = fastify.websocketServer;
      if (wsServer) {
        const statusMessage = JSON.stringify({
          type: 'instance-status',
          payload: {
            instanceId,
            status: newStatus,
            message,
            hookType,
            toolName,
            timestamp: new Date().toISOString(),
          },
        });

        wsServer.clients.forEach((client) => {
          if (client.readyState === 1) {
            // WebSocket.OPEN
            client.send(statusMessage);
          }
        });
      }
    }

    return {
      success: true,
      instanceId,
      status: newStatus,
      previousStatus: instance.status,
    };
  });

  // Get hook script for Claude Code configuration
  fastify.get<{ Params: { instanceId: string } }>(
    '/api/hooks/script/:instanceId',
    async (request) => {
      const { instanceId } = request.params;
      const baseUrl = `http://localhost:${process.env.PORT || 3001}`;

      // Generate the hook script content
      const script = generateHookScript(instanceId, baseUrl);

      return {
        instanceId,
        script,
        instructions: [
          'Add this to your Claude Code hooks configuration:',
          '1. Create or edit ~/.claude/hooks.json',
          '2. Add the hook configurations below',
          '3. Restart Claude Code for changes to take effect',
        ],
        hooksConfig: generateHooksConfig(instanceId, baseUrl),
      };
    }
  );

  // Check for idle instances (called periodically or on demand)
  fastify.get('/api/hooks/check-idle', async () => {
    const db = getDb();
    const now = Date.now();
    const idledInstances: string[] = [];

    // Get all working instances
    const workingInstances = db
      .prepare("SELECT id FROM instances WHERE status = 'working'")
      .all() as { id: string }[];

    for (const instance of workingInstances) {
      const lastActivity = lastActivityMap.get(instance.id);
      if (lastActivity && now - lastActivity > IDLE_TIMEOUT) {
        // Mark as idle due to timeout
        db.prepare(
          `UPDATE instances SET status = 'idle', last_activity_at = datetime('now') WHERE id = ?`
        ).run(instance.id);

        db.prepare(
          `INSERT INTO status_events (instance_id, status, message, timestamp)
           VALUES (?, 'idle', 'Idle timeout - no activity detected', datetime('now'))`
        ).run(instance.id);

        idledInstances.push(instance.id);

        // Broadcast status change
        const wsServer = fastify.websocketServer;
        if (wsServer) {
          const statusMessage = JSON.stringify({
            type: 'instance-status',
            payload: {
              instanceId: instance.id,
              status: 'idle',
              message: 'Idle timeout',
              timestamp: new Date().toISOString(),
            },
          });

          wsServer.clients.forEach((client) => {
            if (client.readyState === 1) {
              client.send(statusMessage);
            }
          });
        }
      }
    }

    return {
      checked: workingInstances.length,
      idled: idledInstances,
    };
  });
};

function generateHookScript(instanceId: string, baseUrl: string): string {
  return `#!/bin/bash
# Claude Code Orchestrator Hook Script
# Instance ID: ${instanceId}

ORCHESTRATOR_URL="${baseUrl}"
INSTANCE_ID="${instanceId}"

# Function to send status update
send_status() {
  local status="$1"
  local message="$2"
  local hook_type="$3"
  local tool_name="$4"

  curl -s -X POST "\${ORCHESTRATOR_URL}/api/hooks/status" \\
    -H "Content-Type: application/json" \\
    -d "{
      \\"instanceId\\": \\"\${INSTANCE_ID}\\",
      \\"status\\": \\"\${status}\\",
      \\"message\\": \\"\${message}\\",
      \\"hookType\\": \\"\${hook_type}\\",
      \\"toolName\\": \\"\${tool_name}\\"
    }" > /dev/null 2>&1
}

# Parse hook type from environment or arguments
HOOK_TYPE="\${CLAUDE_HOOK_TYPE:-\$1}"
TOOL_NAME="\${CLAUDE_TOOL_NAME:-\$2}"

case "\$HOOK_TYPE" in
  "PreToolUse")
    send_status "working" "Using tool: \$TOOL_NAME" "PreToolUse" "\$TOOL_NAME"
    ;;
  "PostToolUse")
    send_status "working" "Completed: \$TOOL_NAME" "PostToolUse" "\$TOOL_NAME"
    ;;
  "Stop")
    send_status "idle" "Session stopped" "Stop" ""
    ;;
  "Notification")
    send_status "awaiting" "\$2" "Notification" ""
    ;;
  *)
    send_status "working" "Activity detected" "" ""
    ;;
esac
`;
}

function generateHooksConfig(instanceId: string, baseUrl: string): object {
  return {
    hooks: {
      PreToolUse: [
        {
          type: 'command',
          command: `curl -s -X POST ${baseUrl}/api/hooks/status -H "Content-Type: application/json" -d '{"instanceId":"${instanceId}","status":"working","hookType":"PreToolUse","toolName":"$TOOL_NAME"}'`,
        },
      ],
      PostToolUse: [
        {
          type: 'command',
          command: `curl -s -X POST ${baseUrl}/api/hooks/status -H "Content-Type: application/json" -d '{"instanceId":"${instanceId}","status":"working","hookType":"PostToolUse","toolName":"$TOOL_NAME"}'`,
        },
      ],
      Stop: [
        {
          type: 'command',
          command: `curl -s -X POST ${baseUrl}/api/hooks/status -H "Content-Type: application/json" -d '{"instanceId":"${instanceId}","status":"idle","hookType":"Stop"}'`,
        },
      ],
    },
  };
}
