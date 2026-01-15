// Instance types
export type InstanceStatus = 'working' | 'idle' | 'error' | 'disconnected';
export type MachineType = 'local' | 'remote';

export interface Instance {
  id: string;
  name: string;
  workingDir: string;
  status: InstanceStatus;
  isPinned: boolean;
  displayOrder: number;
  pid: number | null;
  machineType: MachineType;
  machineId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface CreateInstanceRequest {
  name: string;
  workingDir: string;
  startupCommand?: string; // Optional command to run after terminal starts
  machineType?: MachineType; // 'local' or 'remote', defaults to 'local'
  machineId?: string; // Required if machineType is 'remote'
}

// Remote Machine types
export type MachineStatus = 'online' | 'offline' | 'unknown';

export interface RemoteMachine {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  sshKeyPath: string | null;
  forwardCredentials: boolean;
  status: MachineStatus;
  lastConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMachineRequest {
  name: string;
  hostname: string;
  port?: number;
  username: string;
  sshKeyPath?: string;
  forwardCredentials?: boolean;
}

export interface UpdateMachineRequest {
  name?: string;
  hostname?: string;
  port?: number;
  username?: string;
  sshKeyPath?: string;
  forwardCredentials?: boolean;
}

// Port Forward types
export type PortForwardStatus = 'active' | 'closed';

export interface PortForward {
  id: string;
  instanceId: string;
  remotePort: number;
  localPort: number;
  status: PortForwardStatus;
  createdAt: string;
}

// Listening Port Detection types
export interface DetectedPort {
  port: number;
  pid: number | null;
  processName: string | null;
  bindAddress: string; // '127.0.0.1', '0.0.0.0', '*', or specific IP
  isAccessible: boolean; // true if bound to 0.0.0.0 or *, false if localhost only
  detectedAt: string;
}

export interface InstancePorts {
  instanceId: string;
  ports: DetectedPort[];
  tailscaleIp: string | null;
  lastScannedAt: string;
}

// SSH Key types
export interface SSHKey {
  name: string;
  path: string;
  hasPublicKey: boolean;
}

export interface UpdateInstanceRequest {
  name?: string;
  isPinned?: boolean;
  displayOrder?: number;
}

export interface ReorderInstancesRequest {
  instanceIds: string[];
}

// Global Task types
export type TaskStatus = 'captured' | 'in_progress' | 'done' | 'archived';

export interface GlobalTask {
  id: string;
  text: string;
  status: TaskStatus;
  dispatchedInstanceId: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  text: string;
}

export interface UpdateTaskRequest {
  text?: string;
  status?: TaskStatus;
  dispatchedInstanceId?: string | null;
}

export interface DispatchTaskRequest {
  instanceId: string;
  copyToClipboard?: boolean;
}

export interface ReorderTasksRequest {
  taskIds: string[];
}

export interface TaskStats {
  total: number;
  captured: number;
  inProgress: number;
  done: number;
}

// Activity Feed types
export type ActivityEventType = 'completed' | 'error' | 'started';

export interface ActivityEvent {
  id: string;
  instanceId: string | null; // null if instance deleted
  instanceName: string;
  eventType: ActivityEventType;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
}

export interface ActivityFeedStats {
  total: number;
  unread: number;
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
  event: 'notification';
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
  | 'feed:new'
  | 'feed:updated'
  | 'port:detected'
  | 'port:forwarded'
  | 'port:closed'
  | 'ports:updated'
  | 'machine:created'
  | 'machine:updated'
  | 'machine:deleted'
  | 'machine:status'
  | 'task:created'
  | 'task:updated'
  | 'task:deleted'
  | 'log:status'
  | 'keychain:unlock-failed'
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
  event?: ActivityEvent;
  portForward?: PortForward;
  instancePorts?: InstancePorts;
  machine?: RemoteMachine;
  machineId?: string;
  machineStatus?: { machineId: string; status: MachineStatus };
  task?: GlobalTask;
  taskId?: string;
  error?: string;
  // Keychain unlock failure fields
  keychainError?: string;
  // Status log fields (for log:status messages)
  logType?: 'status-change' | 'hook-received' | 'instance-lookup' | 'file-check' | 'timeout-check';
  timestamp?: number;
  instanceName?: string;
  oldStatus?: string;
  newStatus?: string;
  changed?: boolean;
  source?: 'hook' | 'local-poll' | 'remote-poll' | 'timeout';
  reason?: string;
  metadata?: Record<string, unknown>;
  hookType?: string;
  projectDir?: string;
  sessionDir?: string;
  fileFound?: boolean;
  ageSeconds?: number;
  threshold?: number;
  result?: 'working' | 'idle';
  timeSinceActivityMs?: number;
  thresholdMs?: number;
  fileCheckResult?: 'working' | 'idle';
  action?: 'reset' | 'extend' | 'skip';
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
  // Activity Feed settings
  showActivityInNav: boolean;
  feedEnabledEventTypes: ActivityEventType[];
  feedRetentionDays: number;
  feedMaxItems: number;
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
  // Activity Feed defaults
  showActivityInNav: true,
  feedEnabledEventTypes: ['completed'],
  feedRetentionDays: 7,
  feedMaxItems: 20,
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

// Summary types
export type SummaryType = 'daily' | 'weekly';

export interface GenerateSummaryRequest {
  type: SummaryType;
  includePRs: boolean;
  includeCommits: boolean;
  includeIssues: boolean;
  customPrompt?: string;
}

export interface SummaryRawData {
  prsCreated: unknown[];
  prsMerged: unknown[];
  issuesClosed: unknown[];
  commits: string[];
  activityEvents: unknown[];
}

export interface GenerateSummaryResponse {
  summary: string;
  rawData: SummaryRawData;
  commandsExecuted: string[];
}

// SSE streaming event types for summary generation
export interface SummaryCommandStartEvent {
  type: 'command_start';
  command: string;
  index: number;
}

export interface SummaryCommandCompleteEvent {
  type: 'command_complete';
  command: string;
  index: number;
  success: boolean;
  resultCount?: number;
}

export interface SummaryCompleteEvent {
  type: 'summary_complete';
  data: GenerateSummaryResponse;
}

export interface SummaryErrorEvent {
  type: 'error';
  message: string;
}

export type SummarySSEEvent =
  | SummaryCommandStartEvent
  | SummaryCommandCompleteEvent
  | SummaryCompleteEvent
  | SummaryErrorEvent;

// Command status for UI display
export type CommandStatus = 'pending' | 'running' | 'success' | 'error';

export interface CommandExecution {
  command: string;
  status: CommandStatus;
  resultCount?: number;
}
