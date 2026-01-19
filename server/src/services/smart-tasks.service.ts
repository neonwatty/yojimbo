import { gatherFullContext, formatContextForPrompt } from './context-gathering.service.js';
import { parseTasks, clarifyTasks, checkClaudeCliAvailable } from './claude-cli.service.js';
import type { ParsedTasksResponse, ParsedTask } from '@cc-orchestrator/shared';

/**
 * Stored parsing sessions for multi-turn clarification
 */
interface ParsingSession {
  sessionId: string;
  input: string;
  tasks: ParsedTasksResponse;
  clarificationRound: number;
  createdAt: Date;
}

const sessions = new Map<string, ParsingSession>();

// Clean up old sessions after 30 minutes
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function cleanupOldSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt.getTime() > SESSION_TIMEOUT_MS) {
      sessions.delete(id);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupOldSessions, 5 * 60 * 1000);

/**
 * Parse free-form task input into structured tasks
 *
 * @param input - Raw user input (voice transcription or typed text)
 * @returns Parsed tasks with session info for potential clarification
 */
export async function parseTaskInput(
  input: string
): Promise<{
  success: true;
  data: ParsedTasksResponse;
  sessionId: string;
  needsClarification: boolean;
  cost: number;
} | { success: false; error: string }> {
  // Check if Claude CLI is available
  const cliAvailable = await checkClaudeCliAvailable();
  if (!cliAvailable) {
    return {
      success: false,
      error: 'Claude CLI is not available. Make sure "claude" is installed and in your PATH.',
    };
  }

  // Gather context
  console.log('📊 Gathering project and instance context...');
  const context = await gatherFullContext();

  if (context.projects.length === 0) {
    console.log('⚠️ No projects registered. Tasks will need manual project assignment.');
  }

  // Format context for prompt
  const contextPrompt = formatContextForPrompt(context);

  // Call Claude CLI
  const result = await parseTasks(input, contextPrompt);

  if (!result.success) {
    return result;
  }

  // Check if any tasks need clarification
  const needsClarification = result.data.tasks.some(
    task => task.clarity !== 'clear' || task.clarificationNeeded
  );

  // Store session for potential follow-up
  const session: ParsingSession = {
    sessionId: result.sessionId,
    input,
    tasks: result.data,
    clarificationRound: 0,
    createdAt: new Date(),
  };
  sessions.set(result.sessionId, session);

  return {
    success: true,
    data: result.data,
    sessionId: result.sessionId,
    needsClarification,
    cost: result.cost,
  };
}

/**
 * Provide clarification for ambiguous tasks
 *
 * @param sessionId - The session ID from the initial parse
 * @param clarification - User's clarification response
 * @returns Updated parsed tasks
 */
export async function provideTaskClarification(
  sessionId: string,
  clarification: string
): Promise<{
  success: true;
  data: ParsedTasksResponse;
  needsClarification: boolean;
  cost: number;
} | { success: false; error: string }> {
  const session = sessions.get(sessionId);

  if (!session) {
    return {
      success: false,
      error: 'Session not found or expired. Please start a new parsing session.',
    };
  }

  // Limit clarification rounds
  if (session.clarificationRound >= 3) {
    return {
      success: false,
      error: 'Maximum clarification rounds (3) reached. Please edit tasks manually or start over.',
    };
  }

  // Call Claude CLI with session resumption
  const result = await clarifyTasks(sessionId, clarification);

  if (!result.success) {
    return result;
  }

  // Update session
  session.tasks = result.data;
  session.clarificationRound++;

  // Check if still needs clarification
  const needsClarification = result.data.tasks.some(
    task => task.clarity !== 'clear' || task.clarificationNeeded
  );

  return {
    success: true,
    data: result.data,
    needsClarification,
    cost: result.cost,
  };
}

/**
 * Get a stored parsing session
 */
export function getParsingSession(sessionId: string): ParsingSession | null {
  return sessions.get(sessionId) || null;
}

/**
 * Clear a parsing session
 */
export function clearParsingSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

/**
 * Get all tasks that are ready to route (clear clarity)
 */
export function getRoutableTasks(tasks: ParsedTasksResponse): ParsedTask[] {
  return tasks.tasks.filter(task => task.clarity === 'clear' && task.projectId !== null);
}

/**
 * Get tasks that need clarification
 */
export function getTasksNeedingClarification(tasks: ParsedTasksResponse): ParsedTask[] {
  return tasks.tasks.filter(
    task => task.clarity !== 'clear' || task.clarificationNeeded
  );
}

/**
 * Validate that all tasks have project assignments before routing
 */
export function validateTasksForRouting(
  tasks: ParsedTasksResponse
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  for (const task of tasks.tasks) {
    if (task.projectId === null) {
      issues.push(`Task "${task.title}" has no project assignment`);
    }
    if (task.clarity !== 'clear') {
      issues.push(`Task "${task.title}" needs clarification (${task.clarity})`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
