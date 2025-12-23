import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as os from 'os';
import chokidar from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db/connection.js';

interface JsonlMessage {
  type: string;
  message?: {
    role?: string;
    content?: string | { type: string; text?: string }[];
  };
  timestamp?: string;
  costUSD?: number;
  durationMs?: number;
  sessionId?: string;
}

interface ParsedSession {
  id: string;
  projectPath: string;
  jsonlPath: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  tokenCount: number;
  summary: string | null;
  messages: ParsedMessage[];
}

interface ParsedMessage {
  messageType: 'user' | 'assistant' | 'tool';
  preview: string | null;
  tokenCount: number | null;
  toolName: string | null;
  timestamp: string;
}

const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

// Track processed files to avoid duplicates
const processedFiles = new Map<string, number>(); // filepath -> last line count

let watcher: chokidar.FSWatcher | null = null;

export function startSessionWatcher(): void {
  console.log('[SessionWatcher] Starting session watcher...');

  // Initial scan
  scanAllProjects();

  // Watch for new files
  watcher = chokidar.watch(`${PROJECTS_DIR}/**/*.jsonl`, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100,
    },
  });

  watcher.on('add', (filePath) => {
    console.log(`[SessionWatcher] New session file: ${filePath}`);
    processSessionFile(filePath);
  });

  watcher.on('change', (filePath) => {
    console.log(`[SessionWatcher] Session file updated: ${filePath}`);
    processSessionFile(filePath);
  });

  console.log('[SessionWatcher] Watching for session files in:', PROJECTS_DIR);
}

export function stopSessionWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
    console.log('[SessionWatcher] Stopped session watcher');
  }
}

function scanAllProjects(): void {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.log('[SessionWatcher] Projects directory does not exist:', PROJECTS_DIR);
    return;
  }

  try {
    const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectDir = path.join(PROJECTS_DIR, entry.name);
        scanProjectDirectory(projectDir);
      }
    }
  } catch (error) {
    console.error('[SessionWatcher] Error scanning projects:', error);
  }
}

function scanProjectDirectory(projectDir: string): void {
  try {
    const files = fs.readdirSync(projectDir);

    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const filePath = path.join(projectDir, file);
        processSessionFile(filePath);
      }
    }
  } catch (error) {
    console.error(`[SessionWatcher] Error scanning project dir ${projectDir}:`, error);
  }
}

async function processSessionFile(filePath: string): Promise<void> {
  try {
    const lastProcessedLines = processedFiles.get(filePath) || 0;

    // Parse the file
    const session = await parseJsonlFile(filePath, lastProcessedLines);

    if (!session) {
      return;
    }

    // Store in database
    storeSession(session);

    // Update processed count
    processedFiles.set(filePath, session.messageCount);
  } catch (error) {
    console.error(`[SessionWatcher] Error processing ${filePath}:`, error);
  }
}

async function parseJsonlFile(filePath: string, _skipLines: number = 0): Promise<ParsedSession | null> {
  const messages: ParsedMessage[] = [];
  let lineNumber = 0;
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let sessionId: string | null = null;
  let totalTokens = 0;
  let summary: string | null = null;

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNumber++;

    if (!line.trim()) continue;

    try {
      const data = JSON.parse(line) as JsonlMessage;

      // Get session ID from first message
      if (!sessionId && data.sessionId) {
        sessionId = data.sessionId;
      }

      // Track timestamps
      const timestamp = data.timestamp || new Date().toISOString();
      if (!startedAt) {
        startedAt = timestamp;
      }
      endedAt = timestamp;

      // Parse message based on type
      if (data.type === 'user' || data.message?.role === 'user') {
        const content = extractContent(data.message?.content);
        messages.push({
          messageType: 'user',
          preview: content?.substring(0, 200) || null,
          tokenCount: null,
          toolName: null,
          timestamp,
        });

        // Use first user message as summary if we don't have one
        if (!summary && content) {
          summary = content.substring(0, 100);
        }
      } else if (data.type === 'assistant' || data.message?.role === 'assistant') {
        const content = extractContent(data.message?.content);
        messages.push({
          messageType: 'assistant',
          preview: content?.substring(0, 200) || null,
          tokenCount: null,
          toolName: null,
          timestamp,
        });
      } else if (data.type === 'tool_use' || data.type === 'tool_result') {
        messages.push({
          messageType: 'tool',
          preview: null,
          tokenCount: null,
          toolName: data.type,
          timestamp,
        });
      }

      // Track cost/tokens if available
      if (data.costUSD) {
        // Rough token estimate from cost ($0.015/1K input, $0.075/1K output for Claude)
        totalTokens += Math.round((data.costUSD / 0.03) * 1000);
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (messages.length === 0) {
    return null;
  }

  // Extract project path from file path
  // Format: ~/.claude/projects/-Users-foo-project/session.jsonl
  const projectDirName = path.basename(path.dirname(filePath));
  const projectPath = projectDirName.replace(/-/g, '/');

  return {
    id: sessionId || uuidv4(),
    projectPath,
    jsonlPath: filePath,
    startedAt: startedAt || new Date().toISOString(),
    endedAt,
    messageCount: messages.length,
    tokenCount: totalTokens,
    summary,
    messages,
  };
}

function extractContent(content: string | { type: string; text?: string }[] | undefined): string | null {
  if (!content) return null;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const textParts = content
      .filter((c) => c.type === 'text' && c.text)
      .map((c) => c.text);
    return textParts.join('\n') || null;
  }

  return null;
}

function storeSession(session: ParsedSession): void {
  const db = getDatabase();

  try {
    // Check if session already exists
    const existing = db.prepare('SELECT id, message_count FROM sessions WHERE id = ?').get(session.id) as {
      id: string;
      message_count: number;
    } | undefined;

    if (existing) {
      // Update existing session
      db.prepare(`
        UPDATE sessions
        SET ended_at = ?,
            message_count = ?,
            token_count = ?,
            summary = COALESCE(summary, ?)
        WHERE id = ?
      `).run(
        session.endedAt,
        session.messageCount,
        session.tokenCount,
        session.summary,
        session.id
      );

      // Only insert new messages
      if (session.messageCount > existing.message_count) {
        const insertMessage = db.prepare(`
          INSERT INTO session_messages (session_id, message_type, preview, token_count, tool_name, timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const newMessages = session.messages.slice(existing.message_count);
        for (const msg of newMessages) {
          insertMessage.run(
            session.id,
            msg.messageType,
            msg.preview,
            msg.tokenCount,
            msg.toolName,
            msg.timestamp
          );
        }
      }
    } else {
      // Insert new session
      db.prepare(`
        INSERT INTO sessions (id, project_path, jsonl_path, started_at, ended_at, message_count, token_count, summary)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session.id,
        session.projectPath,
        session.jsonlPath,
        session.startedAt,
        session.endedAt,
        session.messageCount,
        session.tokenCount,
        session.summary
      );

      // Insert messages
      const insertMessage = db.prepare(`
        INSERT INTO session_messages (session_id, message_type, preview, token_count, tool_name, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const msg of session.messages) {
        insertMessage.run(
          session.id,
          msg.messageType,
          msg.preview,
          msg.tokenCount,
          msg.toolName,
          msg.timestamp
        );
      }

      console.log(`[SessionWatcher] Stored new session: ${session.id} with ${session.messageCount} messages`);
    }
  } catch (error) {
    console.error('[SessionWatcher] Error storing session:', error);
  }
}

// Export for testing
export { parseJsonlFile, storeSession };
