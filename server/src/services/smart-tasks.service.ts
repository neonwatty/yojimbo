import { gatherFullContext, formatContextForPrompt } from './context-gathering.service.js';
import { parseTasks, clarifyTasks, checkClaudeCliAvailable } from './claude-cli.service.js';
import {
  cloneRepository,
  validateClonePath,
  extractRepoName,
  expandPath,
} from './git-clone.service.js';
import { createProject } from './projects.service.js';
import { broadcast } from '../websocket/server.js';
import type {
  ParsedTasksResponse,
  ParsedTask,
  SetupProjectRequest,
  SetupProjectResponse,
  ValidatePathResponse,
  SetupProgressEvent,
} from '@cc-orchestrator/shared';

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

/**
 * Helper to broadcast setup progress
 */
function broadcastSetupProgress(event: SetupProgressEvent): void {
  broadcast({
    type: 'setup:progress',
    setupProgress: event,
  });
}

/**
 * Validate a path for cloning
 */
export function validatePath(path: string): ValidatePathResponse {
  return validateClonePath(path);
}

/**
 * Set up a project by cloning and creating an instance
 *
 * This handles the full flow:
 * 1. Clone the repository to the target path
 * 2. Create an instance with the cloned directory
 * 3. Register the project with git info
 *
 * @param request - Setup project request
 * @param createInstanceFn - Function to create an instance (passed to avoid circular deps)
 */
export async function setupProject(
  request: SetupProjectRequest,
  createInstanceFn: (name: string, workingDir: string) => Promise<{ id: string; name: string }>
): Promise<SetupProjectResponse> {
  const { sessionId, gitRepoUrl, targetPath, instanceName } = request;

  // Validate session exists
  const session = sessions.get(sessionId);
  if (!session) {
    return {
      success: false,
      error: 'Session not found or expired',
      step: 'failed',
    };
  }

  // Validate path before cloning
  const pathValidation = validateClonePath(targetPath);
  if (!pathValidation.valid) {
    return {
      success: false,
      error: pathValidation.error || 'Invalid path',
      step: 'failed',
    };
  }

  const expandedPath = pathValidation.expandedPath;
  const repoName = extractRepoName(gitRepoUrl);
  const finalInstanceName = instanceName || repoName.split('/').pop() || 'new-project';

  try {
    // Step 1: Clone repository
    console.log(`🔄 Cloning ${gitRepoUrl} to ${expandedPath}...`);
    broadcastSetupProgress({
      step: 'cloning',
      message: `Cloning ${repoName}...`,
      sessionId,
    });

    const cloneResult = await cloneRepository(gitRepoUrl, targetPath);

    if (!cloneResult.success) {
      broadcastSetupProgress({
        step: 'error',
        message: 'Clone failed',
        sessionId,
        error: cloneResult.error,
      });
      return {
        success: false,
        error: cloneResult.error,
        step: 'failed',
      };
    }

    console.log(`✅ Clone complete: ${expandedPath}`);
    broadcastSetupProgress({
      step: 'clone-complete',
      message: 'Repository cloned successfully',
      sessionId,
    });

    // Step 2: Create instance
    console.log(`🔄 Creating instance "${finalInstanceName}" at ${expandedPath}...`);
    broadcastSetupProgress({
      step: 'creating-instance',
      message: `Creating instance "${finalInstanceName}"...`,
      sessionId,
    });

    let instance: { id: string; name: string };
    try {
      instance = await createInstanceFn(finalInstanceName, expandedPath);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create instance';
      broadcastSetupProgress({
        step: 'error',
        message: 'Instance creation failed',
        sessionId,
        error: errorMsg,
      });
      return {
        success: false,
        error: errorMsg,
        step: 'failed',
        projectPath: expandedPath,
      };
    }

    console.log(`✅ Instance created: ${instance.id}`);
    broadcastSetupProgress({
      step: 'instance-created',
      message: `Instance "${instance.name}" created`,
      sessionId,
    });

    // Step 3: Register project with git info
    console.log(`🔄 Registering project...`);
    broadcastSetupProgress({
      step: 'registering-project',
      message: 'Registering project...',
      sessionId,
    });

    const project = createProject({
      name: finalInstanceName,
      path: expandedPath,
      gitRemote: gitRepoUrl,
      repoName: repoName,
    });

    console.log(`✅ Project registered: ${project.id}`);
    broadcastSetupProgress({
      step: 'complete',
      message: 'Setup complete!',
      sessionId,
    });

    return {
      success: true,
      instanceId: instance.id,
      instanceName: instance.name,
      projectId: project.id,
      projectPath: expandedPath,
      step: 'complete',
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during setup';
    console.error('Setup project error:', err);
    broadcastSetupProgress({
      step: 'error',
      message: 'Setup failed',
      sessionId,
      error: errorMsg,
    });
    return {
      success: false,
      error: errorMsg,
      step: 'failed',
    };
  }
}

/**
 * Get the expanded path for a given path (for display purposes)
 */
export function getExpandedPath(path: string): string {
  return expandPath(path);
}
