import { test, expect } from '../fixtures/test-fixtures';
import { WebSocket } from 'ws';

/**
 * Real Claude Code Integration Tests
 *
 * These tests verify the full integration with Claude Code CLI:
 * 1. Start instance with terminal
 * 2. Run `claude` command
 * 3. Verify status changes via WebSocket
 *
 * Prerequisites:
 * - Claude Code CLI installed (`claude` command available)
 * - API key configured
 * - Hooks installed (`make hooks-install`)
 *
 * Run with: npm run test:e2e:claude
 */

const API_BASE = 'http://localhost:3456/api';
const WS_URL = 'ws://localhost:3456/ws';

// Helper to get the status badge
const statusBadge = (page: any, status: string) =>
  page.locator('span.inline-flex').filter({ hasText: status });

// Status tracker using WebSocket - catches all status changes in real-time
class StatusTracker {
  private ws: WebSocket | null = null;
  private statusHistory: Map<string, string[]> = new Map();
  private connected = false;

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        this.connected = true;
        resolve();
      });

      this.ws.on('error', (err) => {
        reject(err);
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'status:changed' && msg.instanceId) {
            const history = this.statusHistory.get(msg.instanceId) || [];
            history.push(msg.status);
            this.statusHistory.set(msg.instanceId, history);
          }
        } catch {
          // ignore parse errors
        }
      });
    });
  }

  sawStatus(instanceId: string, status: string): boolean {
    const history = this.statusHistory.get(instanceId) || [];
    return history.includes(status);
  }

  getHistory(instanceId: string): string[] {
    return this.statusHistory.get(instanceId) || [];
  }

  async waitForStatus(instanceId: string, status: string, timeout = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.sawStatus(instanceId, status)) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Helper to wait for any status change (polls the API)
async function waitForStatus(
  instanceId: string,
  targetStatus: string,
  timeout = 30000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`${API_BASE}/instances`);
      const data = await response.json();
      const instance = data.data?.find((i: any) => i.id === instanceId);
      if (instance?.status === targetStatus) {
        return true;
      }
    } catch {
      // ignore fetch errors
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Skip these tests unless explicitly enabled
const describeOrSkip = process.env.TEST_CLAUDE_INTEGRATION
  ? test.describe
  : test.describe.skip;

describeOrSkip('Claude Integration', () => {
  test.setTimeout(120000); // 2 minute timeout for Claude operations

  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  test('claude command triggers hooks and status changes', async ({ instancesPage }) => {
    // Connect to WebSocket BEFORE creating instance to catch all status changes
    const tracker = new StatusTracker();
    await tracker.connect();

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();

      // Wait for expanded view with terminal
      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
      const url = instancesPage.page.url();
      const instanceId = url.split('/').pop()!;

      await instancesPage.page.waitForTimeout(2000);

      // Should start as idle
      await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 10000 });

      // Focus terminal and run claude with a prompt that takes a few seconds
      const terminal = instancesPage.page.locator('.xterm-screen');
      await terminal.click();

      // Use a prompt that forces tool usage (Bash/Read/Glob/etc trigger PreToolUse hook)
      await instancesPage.page.keyboard.type('claude -p "list the files in the current directory using ls"');
      await instancesPage.page.keyboard.press('Enter');

      // Wait for the command to complete (status goes back to idle after working)
      // The WebSocket tracker will capture all status changes
      await tracker.waitForStatus(instanceId, 'idle', 60000);

      // Give a moment for the final state to settle
      await instancesPage.page.waitForTimeout(1000);

      // Verify the final state is idle
      await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 5000 });

      // Check if we saw "working" status via WebSocket
      const sawWorking = tracker.sawStatus(instanceId, 'working');
      const history = tracker.getHistory(instanceId);
      console.log(`Status history for ${instanceId}:`, history);

      // The test passes if we saw "working" at some point
      expect(sawWorking).toBe(true);
    } finally {
      tracker.close();
    }
  });

  test('interactive claude session shows working status when given task', async ({ instancesPage }) => {
    // Connect to WebSocket BEFORE creating instance to catch all status changes
    const tracker = new StatusTracker();
    await tracker.connect();

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();

      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
      const url = instancesPage.page.url();
      const instanceId = url.split('/').pop()!;

      await instancesPage.page.waitForTimeout(2000);

      const terminal = instancesPage.page.locator('.xterm-screen');
      await terminal.click();

      // Run claude in interactive mode
      await instancesPage.page.keyboard.type('claude');
      await instancesPage.page.keyboard.press('Enter');

      // Wait for Claude to initialize (show prompt)
      await instancesPage.page.waitForTimeout(5000);

      // Give Claude a task that uses tools (triggers PreToolUse hook → working status)
      await instancesPage.page.keyboard.type('list files in the current directory');
      await instancesPage.page.keyboard.press('Enter');

      // Wait for working status
      await tracker.waitForStatus(instanceId, 'working', 30000);
      const sawWorking = tracker.sawStatus(instanceId, 'working');

      if (sawWorking) {
        // Wait for task to complete (back to idle)
        await tracker.waitForStatus(instanceId, 'idle', 30000);
      }

      // Exit claude
      await instancesPage.page.keyboard.type('/exit');
      await instancesPage.page.keyboard.press('Enter');

      // Give time for exit
      await instancesPage.page.waitForTimeout(2000);

      const history = tracker.getHistory(instanceId);
      console.log(`Status history for ${instanceId}:`, history);

      // The test passes if we saw "working" at some point
      expect(sawWorking).toBe(true);
    } finally {
      tracker.close();
    }
  });

  test('hooks are configured correctly', async ({ instancesPage }) => {
    // This test just verifies the hooks script ran successfully
    // by checking that we can create an instance and the server is receiving hooks

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    const url = instancesPage.page.url();
    const instanceId = url.split('/').pop()!;

    await instancesPage.page.waitForTimeout(2000);

    // Verify instance exists and has idle status
    const response = await fetch(`${API_BASE}/instances`);
    const data = await response.json();
    const instance = data.data?.find((i: any) => i.id === instanceId);

    expect(instance).toBeDefined();
    expect(instance.status).toBe('idle');

    // Manually trigger a hook to verify the API works
    const hookResponse = await fetch(`${API_BASE}/hooks/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'working', projectDir: instance.workingDir, instanceId }),
    });

    expect(hookResponse.ok).toBe(true);

    // Verify status changed
    await instancesPage.page.waitForTimeout(500);
    await expect(statusBadge(instancesPage.page, 'Working')).toBeVisible({ timeout: 5000 });

    // Reset to idle
    await fetch(`${API_BASE}/hooks/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir: instance.workingDir, instanceId }),
    });
  });
});
