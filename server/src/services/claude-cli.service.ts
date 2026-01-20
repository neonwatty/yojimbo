import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ParsedTasksResponse } from '@cc-orchestrator/shared';
import { broadcast } from '../websocket/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Broadcast smart task progress to connected clients
 */
function broadcastProgress(
  step: 'started' | 'parsing' | 'tool-call' | 'tool-result' | 'completed' | 'error',
  message: string,
  extra?: { toolName?: string; toolInput?: string; toolOutput?: string }
): void {
  broadcast({
    type: 'smart-task:progress',
    smartTaskProgress: {
      step,
      message,
      ...extra,
    },
  });
}

/**
 * JSON Schema for ParsedTasksResponse
 * Used with --json-schema flag to enforce structured output
 */
const PARSED_TASKS_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique identifier for this task (UUID format)' },
          originalText: { type: 'string', description: 'The portion of the original input this task came from' },
          title: { type: 'string', description: 'Clean, actionable task title' },
          type: {
            type: 'string',
            enum: ['bug', 'feature', 'enhancement', 'refactor', 'docs', 'other'],
            description: 'Task type category',
          },
          projectId: {
            type: ['string', 'null'],
            description: 'Matched project ID or null if unknown',
          },
          projectConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Confidence score for project match (0-1)',
          },
          clarity: {
            type: 'string',
            enum: ['clear', 'ambiguous', 'unknown_project'],
            description: 'How clear the task is',
          },
          clarificationNeeded: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'Natural language clarification question' },
            },
            required: ['question'],
          },
        },
        required: ['id', 'originalText', 'title', 'type', 'projectId', 'projectConfidence', 'clarity'],
      },
    },
    suggestedOrder: {
      type: 'array',
      items: { type: 'string' },
      description: 'Task IDs in recommended execution order',
    },
  },
  required: ['tasks', 'suggestedOrder'],
};

/**
 * Response from Claude CLI with --output-format json
 */
interface ClaudeCliResponse {
  session_id: string;
  result: string;
  structured_output?: ParsedTasksResponse;
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
}

/**
 * Get the path to the task parser system prompt file
 */
function getPromptFilePath(): string {
  // The prompt file will be in server/prompts/
  return path.resolve(__dirname, '../../prompts/task-parser.txt');
}

/**
 * Invoke the Claude CLI to parse tasks
 *
 * @param userInput - The raw task input from the user
 * @param contextPrompt - Pre-gathered context formatted as a string
 * @returns Parsed tasks response or error
 */
export async function parseTasks(
  userInput: string,
  contextPrompt: string
): Promise<{ success: true; data: ParsedTasksResponse; sessionId: string; cost: number } | { success: false; error: string }> {
  return new Promise((resolve) => {
    const promptFilePath = getPromptFilePath();
    const fullPrompt = `${contextPrompt}\n\n---\n\n## User Input\n\n${userInput}`;

    const args = [
      '-p', fullPrompt,
      '--append-system-prompt-file', promptFilePath,
      '--output-format', 'stream-json',  // Use streaming for real-time progress
      '--verbose',  // Required for stream-json
      '--json-schema', JSON.stringify(PARSED_TASKS_SCHEMA),
      '--max-turns', '6',  // Allow turns for GitHub repo lookups via Bash
      '--allowedTools', 'Bash',  // Enable Bash for gh commands
      '--print',  // Non-interactive mode
    ];

    console.log('🤖 Invoking Claude CLI for task parsing (with GitHub lookup enabled)...');
    console.log('📋 Input:', userInput.substring(0, 100));
    console.log('📋 Context prompt length:', contextPrompt.length, 'chars');
    broadcastProgress('started', 'Starting task parsing...');

    // After a short delay, show that Claude is working
    setTimeout(() => {
      broadcastProgress('parsing', 'Claude is analyzing your input...');
    }, 500);

    const claude = spawn('claude', args, {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],  // stdin ignored, stdout/stderr piped
    });

    let stdoutBuffer = '';
    let stderr = '';
    let finalResult: ClaudeCliResponse | null = null;

    claude.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();

      // Process complete lines (streaming JSON outputs one JSON object per line)
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);

          // Handle different event types
          if (event.type === 'assistant' && event.message?.content) {
            // Check for tool_use in assistant message
            for (const content of event.message.content) {
              if (content.type === 'tool_use') {
                const toolName = content.name || 'Unknown';
                const input = content.input?.command || content.input?.description || '';

                // Check for GitHub commands
                if (input.includes('gh search repos')) {
                  broadcastProgress('tool-call', 'Searching GitHub for repository...', { toolName, toolInput: input });
                } else if (input.includes('gh repo list')) {
                  broadcastProgress('tool-call', 'Fetching recent GitHub repositories...', { toolName, toolInput: input });
                } else {
                  broadcastProgress('tool-call', `Running ${toolName}...`, { toolName, toolInput: input });
                }
              }
            }
          } else if (event.type === 'user' && event.tool_use_result) {
            // Tool result received
            broadcastProgress('tool-result', 'Processing tool response...');
          } else if (event.type === 'result') {
            // Final result
            finalResult = event as ClaudeCliResponse;
          }
        } catch {
          // Not valid JSON, ignore
        }
      }
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('error', (error) => {
      console.error('❌ Claude CLI spawn error:', error.message);
      resolve({
        success: false,
        error: `Failed to spawn Claude CLI: ${error.message}. Make sure 'claude' is installed and in PATH.`,
      });
    });

    claude.on('close', (code) => {
      console.log(`Claude CLI exited with code ${code}`);

      if (code === 0) {
        try {
          // Process any remaining buffer
          if (stdoutBuffer.trim()) {
            try {
              const event = JSON.parse(stdoutBuffer);
              if (event.type === 'result') {
                finalResult = event as ClaudeCliResponse;
              }
            } catch {
              // Ignore parse errors
            }
          }

          if (!finalResult) {
            console.error('No final result received from Claude CLI');
            broadcastProgress('error', 'No response received');
            resolve({
              success: false,
              error: 'No response received from Claude CLI',
            });
            return;
          }

          const response = finalResult;
          console.log('Response turns:', response.num_turns);

          if (response.structured_output) {
            const taskCount = response.structured_output.tasks.length;
            const turnsUsed = response.num_turns;
            console.log(`✅ Task parsing complete. ${taskCount} tasks parsed in ${turnsUsed} turn(s). Cost: $${response.total_cost_usd.toFixed(4)}`);

            broadcastProgress(
              'completed',
              `Parsed ${taskCount} task${taskCount !== 1 ? 's' : ''}${turnsUsed > 1 ? ` (used ${turnsUsed} turns with tool calls)` : ''}`
            );

            resolve({
              success: true,
              data: response.structured_output,
              sessionId: response.session_id,
              cost: response.total_cost_usd,
            });
          } else {
            console.error('❌ No structured output in Claude response');
            broadcastProgress('error', 'No structured output received');
            resolve({
              success: false,
              error: 'Claude did not return structured output. Response: ' + response.result.substring(0, 200),
            });
          }
        } catch (parseError) {
          console.error('Failed to process Claude response:', parseError);
          broadcastProgress('error', 'Failed to process response');
          resolve({
            success: false,
            error: `Failed to process Claude response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          });
        }
      } else {
        console.error(`❌ Claude CLI exited with code ${code}`);
        console.error('stderr:', stderr);
        broadcastProgress('error', `CLI exited with code ${code}`);
        resolve({
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr || 'No error message'}`,
        });
      }
    });

    // Set a timeout for the CLI call (90s to allow for GitHub lookups)
    const timeout = setTimeout(() => {
      console.error('❌ Claude CLI timed out');
      claude.kill();
      resolve({
        success: false,
        error: 'Claude CLI timed out after 90 seconds',
      });
    }, 90000);

    claude.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Continue a conversation for clarification
 *
 * @param sessionId - The session ID from a previous call
 * @param clarification - The user's clarification response
 * @returns Updated parsed tasks
 */
export async function clarifyTasks(
  sessionId: string,
  clarification: string
): Promise<{ success: true; data: ParsedTasksResponse; cost: number } | { success: false; error: string }> {
  return new Promise((resolve) => {
    const args = [
      '--resume', sessionId,
      '-p', `User clarification: ${clarification}\n\nPlease update the task parsing based on this clarification and return the complete updated ParsedTasksResponse.`,
      '--output-format', 'json',
      '--json-schema', JSON.stringify(PARSED_TASKS_SCHEMA),
      '--max-turns', '6',  // Allow turns for GitHub repo lookups via Bash
      '--allowedTools', 'Bash',  // Enable Bash for gh commands
      '--print',
    ];

    console.log('🤖 Continuing Claude CLI session for clarification (with GitHub lookup enabled)...');

    const claude = spawn('claude', args, {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    claude.on('error', (error) => {
      console.error('❌ Claude CLI spawn error:', error.message);
      resolve({
        success: false,
        error: `Failed to spawn Claude CLI: ${error.message}`,
      });
    });

    claude.on('close', (code) => {
      if (code === 0) {
        try {
          const response: ClaudeCliResponse = JSON.parse(stdout);

          if (response.structured_output) {
            console.log(`✅ Clarification processed. Cost: $${response.total_cost_usd.toFixed(4)}`);
            resolve({
              success: true,
              data: response.structured_output,
              cost: response.total_cost_usd,
            });
          } else {
            resolve({
              success: false,
              error: 'Claude did not return structured output after clarification',
            });
          }
        } catch (parseError) {
          resolve({
            success: false,
            error: `Failed to parse Claude response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          });
        }
      } else {
        resolve({
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr || 'No error message'}`,
        });
      }
    });

    // Set a timeout (90s to allow for GitHub lookups)
    const timeout = setTimeout(() => {
      claude.kill();
      resolve({
        success: false,
        error: 'Claude CLI timed out after 90 seconds',
      });
    }, 90000);

    claude.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Check if Claude CLI is available
 */
export async function checkClaudeCliAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const claude = spawn('claude', ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    claude.on('error', () => {
      resolve(false);
    });

    claude.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

export { PARSED_TASKS_SCHEMA };
