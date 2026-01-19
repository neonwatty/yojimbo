import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ParsedTasksResponse } from '@cc-orchestrator/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      '--output-format', 'json',
      '--json-schema', JSON.stringify(PARSED_TASKS_SCHEMA),
      '--max-turns', '3',
      '--print',  // Non-interactive mode
    ];

    console.log('🤖 Invoking Claude CLI for task parsing...');

    const claude = spawn('claude', args, {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],  // stdin ignored, stdout/stderr piped
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
        error: `Failed to spawn Claude CLI: ${error.message}. Make sure 'claude' is installed and in PATH.`,
      });
    });

    claude.on('close', (code) => {
      if (code === 0) {
        try {
          const response: ClaudeCliResponse = JSON.parse(stdout);

          if (response.structured_output) {
            console.log(`✅ Task parsing complete. ${response.structured_output.tasks.length} tasks parsed. Cost: $${response.total_cost_usd.toFixed(4)}`);
            resolve({
              success: true,
              data: response.structured_output,
              sessionId: response.session_id,
              cost: response.total_cost_usd,
            });
          } else {
            console.error('❌ No structured output in Claude response');
            resolve({
              success: false,
              error: 'Claude did not return structured output. Response: ' + response.result.substring(0, 200),
            });
          }
        } catch (parseError) {
          console.error('❌ Failed to parse Claude response:', parseError);
          console.error('Raw stdout:', stdout.substring(0, 500));
          resolve({
            success: false,
            error: `Failed to parse Claude response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
          });
        }
      } else {
        console.error(`❌ Claude CLI exited with code ${code}`);
        console.error('stderr:', stderr);
        resolve({
          success: false,
          error: `Claude CLI exited with code ${code}: ${stderr || 'No error message'}`,
        });
      }
    });

    // Set a timeout for the CLI call
    const timeout = setTimeout(() => {
      console.error('❌ Claude CLI timed out');
      claude.kill();
      resolve({
        success: false,
        error: 'Claude CLI timed out after 60 seconds',
      });
    }, 60000);

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
      '--max-turns', '3',
      '--print',
    ];

    console.log('🤖 Continuing Claude CLI session for clarification...');

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

    // Set a timeout
    const timeout = setTimeout(() => {
      claude.kill();
      resolve({
        success: false,
        error: 'Claude CLI timed out after 60 seconds',
      });
    }, 60000);

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
