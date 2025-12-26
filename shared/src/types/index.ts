// Instance types
export type InstanceStatus = 'working' | 'awaiting' | 'idle' | 'error' | 'disconnected';

export interface Instance {
  id: string;
  name: string;
  workingDir: string;
  status: InstanceStatus;
  isPinned: boolean;
  displayOrder: number;
  pid: number | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface CreateInstanceRequest {
  name: string;
  workingDir: string;
  startupCommand?: string; // Optional command to run after terminal starts
}

export interface UpdateInstanceRequest {
  name?: string;
  isPinned?: boolean;
  displayOrder?: number;
}

export interface ReorderInstancesRequest {
  instanceIds: string[];
}

// Session types
export interface Session {
  id: string;
  instanceId: string | null;
  projectPath: string;
  jsonlPath: string;
  startedAt: string;
  endedAt: string | null;
  messageCount: number;
  tokenCount: number;
  summary: string | null;
}

export interface SessionMessage {
  id: number;
  sessionId: string;
  messageType: 'user' | 'assistant' | 'tool';
  preview: string | null;
  tokenCount: number | null;
  toolName: string | null;
  timestamp: string;
}

// Plan types
export interface Plan {
  id: string;
  name: string;
  path: string;
  folder: string | null;
  content: string;
  isDirty: boolean;
}

export interface CreatePlanRequest {
  workingDir: string;
  name: string;
  content?: string;
}

export interface UpdatePlanRequest {
  content: string;
}

// Mockup types
export interface Mockup {
  id: string;
  name: string;
  path: string;
  folder: string | null;
  content: string;
}

// Hook event types
export interface HookStatusEvent {
  event: 'working' | 'idle';
  projectDir: string;
  sessionId?: string;
}

export interface HookNotificationEvent {
  event: 'awaiting';
  projectDir: string;
  sessionId?: string;
}

export interface HookStopEvent {
  event: 'stopped';
  projectDir: string;
  sessionId?: string;
}

// WebSocket message types
export type WSClientMessageType =
  | 'terminal:input'
  | 'terminal:resize'
  | 'subscribe'
  | 'unsubscribe';

export interface WSClientMessage {
  type: WSClientMessageType;
  instanceId: string;
  data?: string;
  cols?: number;
  rows?: number;
}

export type WSServerMessageType =
  | 'terminal:output'
  | 'instance:created'
  | 'instance:updated'
  | 'instance:closed'
  | 'session:updated'
  | 'status:changed'
  | 'cwd:changed'
  | 'file:changed'
  | 'file:deleted'
  | 'error';

export interface FileChangeEvent {
  fileType: 'plan' | 'mockup';
  fileId: string;
  filePath: string;
  workingDir: string;
  changeType: 'modified' | 'deleted';
  timestamp: string;
}

export interface WSServerMessage {
  type: WSServerMessageType;
  instanceId?: string;
  data?: string;
  instance?: Instance;
  status?: InstanceStatus;
  session?: Session;
  cwd?: string;
  fileChange?: FileChangeEvent;
  error?: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Settings types
export interface ClaudeCodeAlias {
  id: string;
  name: string; // Display name (e.g., "Full Permissions")
  command: string; // The actual command (e.g., "claude --dangerously-skip-permissions")
  isDefault: boolean; // One marked as default
}

export type InstanceMode = 'terminal' | 'claude-code';

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  terminalFontSize: number;
  terminalFontFamily: string;
  showWelcomeBanner: boolean;
  // Claude Code settings
  claudeCodeAliases: ClaudeCodeAlias[];
  lastUsedDirectory: string;
  lastInstanceMode: InstanceMode;
}

export const DEFAULT_CLAUDE_ALIAS: ClaudeCodeAlias = {
  id: 'default',
  name: 'Default',
  command: 'claude',
  isDefault: true,
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  terminalFontSize: 14,
  terminalFontFamily: 'JetBrains Mono',
  showWelcomeBanner: true,
  claudeCodeAliases: [DEFAULT_CLAUDE_ALIAS],
  lastUsedDirectory: '~',
  lastInstanceMode: 'terminal',
};

// Filesystem API types
export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface DirectoryListResponse {
  currentPath: string;
  displayPath: string; // With ~ for home
  entries: DirectoryEntry[];
  hasParent: boolean;
  parentPath: string | null;
}

export interface HomePathResponse {
  path: string;
  displayPath: string;
}

export interface ClaudeCliStatus {
  installed: boolean;
  path: string | null;
  version: string | null;
}
