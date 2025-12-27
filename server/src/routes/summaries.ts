import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ApiResponse } from '@cc-orchestrator/shared';
import { listActivityEvents } from '../services/feed.service.js';

const execAsync = promisify(exec);
const router = Router();

interface SummaryRequest {
  type: 'daily' | 'weekly';
  includePRs: boolean;
  includeCommits: boolean;
  includeIssues: boolean;
  customPrompt?: string;
}

interface SummaryResponse {
  summary: string;
  rawData: {
    prsCreated: unknown[];
    prsMerged: unknown[];
    issuesClosed: unknown[];
    commits: string[];
    activityEvents: unknown[];
  };
  commandsExecuted: string[];
}

// SSE event types for streaming
interface CommandStartEvent {
  type: 'command_start';
  command: string;
  index: number;
}

interface CommandCompleteEvent {
  type: 'command_complete';
  command: string;
  index: number;
  success: boolean;
  resultCount?: number;
}

interface SummaryCompleteEvent {
  type: 'summary_complete';
  data: SummaryResponse;
}

interface ErrorEvent {
  type: 'error';
  message: string;
}

type SSEEvent = CommandStartEvent | CommandCompleteEvent | SummaryCompleteEvent | ErrorEvent;

function sendSSE(res: Response, event: SSEEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function getDateNDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

async function runGhCommand(command: string): Promise<unknown[]> {
  try {
    const { stdout } = await execAsync(command);
    return JSON.parse(stdout || '[]');
  } catch (error) {
    console.warn(`gh command failed: ${command}`, error);
    return [];
  }
}

async function getGitCommits(days: number): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`git log --since="${days} days ago" --oneline`);
    return stdout.split('\n').filter(line => line.trim());
  } catch (error) {
    console.warn('git log command failed', error);
    return [];
  }
}

// Helper to run a command with SSE events
async function runCommandWithSSE(
  res: Response,
  command: string,
  index: number,
  runner: () => Promise<unknown[] | string[]>
): Promise<{ success: boolean; result: unknown[] | string[] }> {
  sendSSE(res, { type: 'command_start', command, index });

  try {
    const result = await runner();
    const resultCount = Array.isArray(result) ? result.length : 0;
    sendSSE(res, { type: 'command_complete', command, index, success: true, resultCount });
    return { success: true, result };
  } catch (error) {
    sendSSE(res, { type: 'command_complete', command, index, success: false });
    return { success: false, result: [] };
  }
}

const DEFAULT_PROMPT = `You are a helpful assistant that summarizes work completed. Based on the following data about what was accomplished {{period}}, write a concise, professional summary suitable for sharing with a team or manager.

Focus on:
- Key accomplishments and completed work
- Notable pull requests and their purpose
- Any significant issues resolved
- Patterns in the work (e.g., "focused on bug fixes" or "primarily feature development")

Keep the summary to 3-5 bullet points or a short paragraph. Be specific but concise.

Here is the raw data:
{{data}}

Write a {{type}} work summary:`;

function buildPrompt(data: {
  type: 'daily' | 'weekly';
  prsCreated: unknown[];
  prsMerged: unknown[];
  issuesClosed: unknown[];
  commits: string[];
  activityEvents: unknown[];
  includePRs: boolean;
  includeCommits: boolean;
  includeIssues: boolean;
  customPrompt?: string;
}): string {
  const period = data.type === 'daily' ? 'today' : 'this week';

  let dataSection = '';

  if (data.includePRs) {
    dataSection += `
## Pull Requests Created
${data.prsCreated.length > 0 ? JSON.stringify(data.prsCreated, null, 2) : 'None'}

## Pull Requests Merged
${data.prsMerged.length > 0 ? JSON.stringify(data.prsMerged, null, 2) : 'None'}
`;
  }

  if (data.includeCommits) {
    dataSection += `
## Commits
${data.commits.length > 0 ? data.commits.join('\n') : 'None'}
`;
  }

  if (data.includeIssues) {
    dataSection += `
## Issues Closed
${data.issuesClosed.length > 0 ? JSON.stringify(data.issuesClosed, null, 2) : 'None'}
`;
  }

  // Always include activity events if available
  dataSection += `
## Claude Code Activity (from Yojimbo)
${data.activityEvents.length > 0 ? JSON.stringify(data.activityEvents, null, 2) : 'None'}
`;

  // Use custom prompt if provided, otherwise use default
  const promptTemplate = data.customPrompt || DEFAULT_PROMPT;

  return promptTemplate
    .replace(/\{\{period\}\}/g, period)
    .replace(/\{\{data\}\}/g, dataSection)
    .replace(/\{\{type\}\}/g, data.type);
}

// POST /api/summaries/generate - Generate a work summary
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { type, includePRs, includeCommits, includeIssues, customPrompt } = req.body as SummaryRequest;
    const days = type === 'weekly' ? 7 : 1;
    const dateStr = getDateNDaysAgo(days);

    console.log(`📊 Generating ${type} summary (since ${dateStr})...`);

    // Track commands executed
    const commandsExecuted: string[] = [];

    // Build commands
    const ghPrsCreatedCmd = `gh search prs --author @me --created ">=${dateStr}" --json title,repository,url,createdAt`;
    const ghPrsMergedCmd = `gh search prs --author @me --merged --merged-at ">=${dateStr}" --json title,repository,url,mergedAt`;
    const ghIssuesClosedCmd = `gh search issues --author @me --closed ">=${dateStr}" --json title,repository,url,closedAt`;
    const gitLogCmd = `git log --since="${days} days ago" --oneline`;

    // Collect data in parallel
    let prsCreated: unknown[] = [];
    let prsMerged: unknown[] = [];
    let issuesClosed: unknown[] = [];
    let commits: string[] = [];

    if (includePRs) {
      commandsExecuted.push(ghPrsCreatedCmd);
      commandsExecuted.push(ghPrsMergedCmd);
      [prsCreated, prsMerged] = await Promise.all([
        runGhCommand(ghPrsCreatedCmd),
        runGhCommand(ghPrsMergedCmd),
      ]);
    }

    if (includeIssues) {
      commandsExecuted.push(ghIssuesClosedCmd);
      issuesClosed = await runGhCommand(ghIssuesClosedCmd);
    }

    if (includeCommits) {
      commandsExecuted.push(gitLogCmd);
      commits = await getGitCommits(days);
    }

    // Get activity events from the feed
    const allEvents = listActivityEvents(100, 0);
    const cutoffDate = new Date(dateStr);
    const activityEvents = allEvents.filter(event => new Date(event.createdAt) >= cutoffDate);

    // Build the prompt
    const prompt = buildPrompt({
      type,
      prsCreated,
      prsMerged,
      issuesClosed,
      commits,
      activityEvents,
      includePRs,
      includeCommits,
      includeIssues,
      customPrompt,
    });

    // Call Claude CLI to generate the summary
    const claudeCmd = `echo '...' | claude --print`;
    commandsExecuted.push(claudeCmd);

    let summary = '';
    try {
      // Escape the prompt for shell and pipe to Claude
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      const { stdout } = await execAsync(`echo '${escapedPrompt}' | claude --print`, {
        timeout: 60000, // 60 second timeout
      });
      summary = stdout.trim();
    } catch (error) {
      console.error('Claude CLI failed:', error);
      // Provide a fallback summary if Claude CLI fails
      summary = `Unable to generate AI summary. Here's a quick overview of ${type === 'daily' ? 'today' : 'this week'}:\n\n` +
        `- PRs Created: ${prsCreated.length}\n` +
        `- PRs Merged: ${prsMerged.length}\n` +
        `- Issues Closed: ${issuesClosed.length}\n` +
        `- Commits: ${commits.length}\n` +
        `- Claude Code Tasks: ${activityEvents.length}`;
    }

    const responseData: SummaryResponse = {
      summary,
      rawData: {
        prsCreated,
        prsMerged,
        issuesClosed,
        commits,
        activityEvents,
      },
      commandsExecuted,
    };

    console.log(`✅ ${type} summary generated successfully`);
    console.log(`📋 Commands executed: ${commandsExecuted.length}`, commandsExecuted);
    const response: ApiResponse<SummaryResponse> = { success: true, data: responseData };
    res.json(response);
  } catch (error) {
    console.error('Failed to generate summary:', error);
    const response: ApiResponse<SummaryResponse> = { success: false, error: 'Failed to generate summary' };
    res.status(500).json(response);
  }
});

// POST /api/summaries/generate-stream - Generate a work summary with SSE streaming
router.post('/generate-stream', async (req: Request, res: Response) => {
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { type, includePRs, includeCommits, includeIssues, customPrompt } = req.body as SummaryRequest;
    const days = type === 'weekly' ? 7 : 1;
    const dateStr = getDateNDaysAgo(days);

    console.log(`📊 Streaming ${type} summary generation (since ${dateStr})...`);

    const commandsExecuted: string[] = [];
    let commandIndex = 0;

    // Build commands
    const ghPrsCreatedCmd = `gh search prs --author @me --created ">=${dateStr}" --json title,repository,url,createdAt`;
    const ghPrsMergedCmd = `gh search prs --author @me --merged --merged-at ">=${dateStr}" --json title,repository,url,mergedAt`;
    const ghIssuesClosedCmd = `gh search issues --author @me --closed ">=${dateStr}" --json title,repository,url,closedAt`;
    const gitLogCmd = `git log --since="${days} days ago" --oneline`;

    let prsCreated: unknown[] = [];
    let prsMerged: unknown[] = [];
    let issuesClosed: unknown[] = [];
    let commits: string[] = [];

    // Run commands sequentially with SSE updates
    if (includePRs) {
      commandsExecuted.push(ghPrsCreatedCmd);
      const result1 = await runCommandWithSSE(res, ghPrsCreatedCmd, commandIndex++, () => runGhCommand(ghPrsCreatedCmd));
      prsCreated = result1.result as unknown[];

      commandsExecuted.push(ghPrsMergedCmd);
      const result2 = await runCommandWithSSE(res, ghPrsMergedCmd, commandIndex++, () => runGhCommand(ghPrsMergedCmd));
      prsMerged = result2.result as unknown[];
    }

    if (includeIssues) {
      commandsExecuted.push(ghIssuesClosedCmd);
      const result = await runCommandWithSSE(res, ghIssuesClosedCmd, commandIndex++, () => runGhCommand(ghIssuesClosedCmd));
      issuesClosed = result.result as unknown[];
    }

    if (includeCommits) {
      commandsExecuted.push(gitLogCmd);
      const result = await runCommandWithSSE(res, gitLogCmd, commandIndex++, () => getGitCommits(days));
      commits = result.result as string[];
    }

    // Get activity events (local, no command needed)
    const allEvents = listActivityEvents(100, 0);
    const cutoffDate = new Date(dateStr);
    const activityEvents = allEvents.filter(event => new Date(event.createdAt) >= cutoffDate);

    // Build the prompt
    const prompt = buildPrompt({
      type,
      prsCreated,
      prsMerged,
      issuesClosed,
      commits,
      activityEvents,
      includePRs,
      includeCommits,
      includeIssues,
      customPrompt,
    });

    // Call Claude CLI with SSE update
    const claudeCmd = `echo '<prompt>' | claude --print`;
    commandsExecuted.push(claudeCmd);
    sendSSE(res, { type: 'command_start', command: claudeCmd, index: commandIndex });

    let summary = '';
    try {
      const escapedPrompt = prompt.replace(/'/g, "'\\''");
      const { stdout } = await execAsync(`echo '${escapedPrompt}' | claude --print`, {
        timeout: 60000,
      });
      summary = stdout.trim();
      sendSSE(res, { type: 'command_complete', command: claudeCmd, index: commandIndex, success: true });
    } catch (error) {
      console.error('Claude CLI failed:', error);
      sendSSE(res, { type: 'command_complete', command: claudeCmd, index: commandIndex, success: false });
      summary = `Unable to generate AI summary. Here's a quick overview of ${type === 'daily' ? 'today' : 'this week'}:\n\n` +
        `- PRs Created: ${prsCreated.length}\n` +
        `- PRs Merged: ${prsMerged.length}\n` +
        `- Issues Closed: ${issuesClosed.length}\n` +
        `- Commits: ${commits.length}\n` +
        `- Claude Code Tasks: ${activityEvents.length}`;
    }

    // Send final complete event
    const responseData: SummaryResponse = {
      summary,
      rawData: {
        prsCreated,
        prsMerged,
        issuesClosed,
        commits,
        activityEvents,
      },
      commandsExecuted,
    };

    sendSSE(res, { type: 'summary_complete', data: responseData });
    console.log(`✅ ${type} summary streaming completed`);
    res.end();
  } catch (error) {
    console.error('Failed to generate summary:', error);
    sendSSE(res, { type: 'error', message: 'Failed to generate summary' });
    res.end();
  }
});

export default router;
