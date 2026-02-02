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
export type PortForwardStatus = 'active' | 'closed' | 'reconnecting' | 'failed';

export interface PortForward {
  id: string;
  instanceId: string;
  remotePort: number;
  localPort: number;
  status: PortForwardStatus;
  reconnectAttempts: number; // Number of reconnect attempts made
  lastError: string | null; // Last error message if failed
  createdAt: string;
}

// Listening Port Detection types
export type ServiceType =
  | 'vite'
  | 'nextjs'
  | 'cra'        // Create React App
  | 'webpack'
  | 'parcel'
  | 'esbuild'
  | 'flask'
  | 'django'
  | 'rails'
  | 'express'
  | 'fastify'
  | 'nest'
  | 'spring'
  | 'go'
  | 'rust'
  | 'php'
  | 'python'
  | 'ruby'
  | 'node'
  | 'unknown';

export interface DetectedPort {
  port: number;
  pid: number | null;
  processName: string | null;
  bindAddress: string; // '127.0.0.1', '0.0.0.0', '*', or specific IP
  isAccessible: boolean; // true if bound to 0.0.0.0 or *, false if localhost only
  serviceType: ServiceType; // Detected framework/service type
  detectedAt: string;
}

export interface InstancePorts {
  instanceId: string;
  ports: DetectedPort[];
  tailscaleIp: string | null;
  lastScannedAt: string;
}

// HTML Files Viewer types
export interface HtmlFile {
  id: string;           // MD5 hash of path
  name: string;         // Filename (e.g., "mockup.html")
  path: string;         // Full filesystem path
  addedAt: string;      // ISO timestamp
}

export interface InstanceHtmlFiles {
  instanceId: string;
  files: HtmlFile[];
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

// Global Todo types
export type TodoStatus = 'captured' | 'in_progress' | 'done' | 'archived';

export interface GlobalTodo {
  id: string;
  text: string;
  status: TodoStatus;
  dispatchedInstanceId: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoRequest {
  text: string;
}

export interface UpdateTodoRequest {
  text?: string;
  status?: TodoStatus;
  dispatchedInstanceId?: string | null;
}

export interface DispatchTodoRequest {
  instanceId: string;
  copyToClipboard?: boolean;
}

export interface ReorderTodosRequest {
  todoIds: string[];
}

export interface TodoStats {
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

// Preflight check types
export type PreflightCheckStatus = 'pass' | 'fail' | 'warn' | 'skip';
export type PreflightOverallStatus = 'ready' | 'warnings' | 'not_ready';

export interface PreflightCheckResult {
  name: string;
  status: PreflightCheckStatus;
  message: string;
  details?: string;
}

export interface PreflightResult {
  machineId: string;
  machineName: string;
  timestamp: string;
  overall: PreflightOverallStatus;
  checks: PreflightCheckResult[];
  summary: {
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}

// Hook verification types
export type HookInstallationStatus = 'installed' | 'partial' | 'missing' | 'error';

export interface HookVerificationResult {
  success: boolean;
  status: HookInstallationStatus;
  installedHooks: string[];
  missingHooks: string[];
  invalidHooks: string[];
  details?: string;
  error?: string;
}

export interface ToolCheckResult {
  success: boolean;
  available: string[];
  missing: string[];
  error?: string;
}

// Tunnel types
export type TunnelHealthState = 'healthy' | 'degraded' | 'disconnected' | 'reconnecting';

export interface TunnelStatus {
  machineId: string;
  machineName: string;
  healthState: TunnelHealthState;
  remotePort: number;
  localPort: number;
  instanceCount: number;
  lastSeenAt: string | null;
  lastHealthCheck: string | null;
  reconnectAttempts: number;
  error: string | null;
}

export interface TunnelStateChange {
  machineId: string;
  previousState: TunnelHealthState | null;
  newState: TunnelHealthState;
  error?: string;
  timestamp: string;
}

// Keychain unlock verification types
export interface KeychainVerificationResult {
  success: boolean;
  isUnlocked: boolean;
  verificationMethod: 'show-keychain-info' | 'session-cache';
  error?: string;
}

export interface KeychainUnlockResult {
  success: boolean;
  machineId: string;
  machineName: string;
  attempts: number;
  verified: boolean;
  error?: string;
}

export interface KeychainStatusChange {
  machineId: string;
  machineName: string;
  unlocked: boolean;
  verified: boolean;
  attempts?: number;
  error?: string;
  timestamp: string;
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
  | 'machine:preflight'
  | 'tunnel:state'
  | 'todo:created'
  | 'todo:updated'
  | 'todo:deleted'
  | 'log:status'
  | 'keychain:unlock-failed'
  | 'keychain:unlock-success'
  | 'keychain:status-change'
  | 'smart-todo:progress'
  | 'setup:progress'
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
  tunnelState?: TunnelStateChange;
  preflightResult?: PreflightResult;
  todo?: GlobalTodo;
  todoId?: string;
  error?: string;
  // Keychain status fields
  keychainStatus?: KeychainStatusChange;
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
  // Smart todo progress fields
  smartTodoProgress?: {
    step: 'started' | 'parsing' | 'tool-call' | 'tool-result' | 'completed' | 'error';
    message: string;
    toolName?: string;
    toolInput?: string;
    toolOutput?: string;
  };
  // Setup progress fields (for setup:progress messages)
  setupProgress?: SetupProgressEvent;
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

// Release types for What's New feature
export interface Release {
  version: string;
  name: string;
  body: string;
  publishedAt: string;
  url: string;
  isPrerelease: boolean;
}

// Project Registry types
export interface Project {
  id: string;
  name: string;
  path: string;
  gitRemote: string | null;
  repoName: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  path: string;
  gitRemote?: string;
  repoName?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  gitRemote?: string;
  repoName?: string;
}

// Smart Todo Parsing types
export type ParsedTodoType = 'bug' | 'feature' | 'enhancement' | 'refactor' | 'docs' | 'other';
export type TodoClarity = 'clear' | 'ambiguous' | 'unknown_project';

export interface ProjectMatch {
  projectId: string;
  confidence: number;
  reason?: string;  // Why this project matched (optional, for UI tooltip)
}

export interface ParsedTodo {
  id: string;
  originalText: string;
  title: string;
  type: ParsedTodoType;
  // Primary selection (backwards compatible)
  projectId: string | null;
  projectConfidence: number;
  // Top matches (up to 3) for user selection
  projectMatches?: ProjectMatch[];
  clarity: TodoClarity;
  clarificationNeeded?: {
    question: string;
  };
}

export interface ParsedTodosResponse {
  todos: ParsedTodo[];
  suggestedOrder: string[];
}

export interface ParseTodosRequest {
  input: string;
}

export interface ClarifyTodoRequest {
  sessionId: string;
  clarification: string;
}

// Context types for todo parsing
export interface InstanceContext {
  id: string;
  name: string;
  dir: string;
  status: 'working' | 'idle';
  projectId?: string;
}

export interface GitStateContext {
  branch: string;
  commits: Array<{ hash: string; msg: string; age: string }>;
  dirty: boolean;
  ahead?: number;
  behind?: number;
}

export interface ProjectContext {
  id: string;
  name: string;
  path: string;
  repoName: string | null;
  gitState?: GitStateContext;
}

// Smart Todos: Clone and Setup types
export type SetupProjectAction = 'clone-and-create' | 'associate-existing';

export interface SetupProjectRequest {
  sessionId: string;
  todoId?: string;
  action: SetupProjectAction;
  gitRepoUrl: string;           // e.g., "git@github.com:owner/repo.git"
  targetPath: string;           // e.g., "~/Desktop/repo-name"
  instanceName?: string;        // e.g., "repo-dev" (defaults to repo name)
}

export interface SetupProjectResponse {
  success: boolean;
  instanceId?: string;
  instanceName?: string;
  projectId?: string;
  projectPath?: string;
  error?: string;
  step?: 'cloning' | 'creating-instance' | 'registering-project' | 'complete' | 'failed';
}

export interface ValidatePathRequest {
  path: string;
}

export interface ValidatePathResponse {
  valid: boolean;
  exists: boolean;
  parentExists: boolean;
  expandedPath: string;
  error?: string;
}

// WebSocket setup progress events
export interface SetupProgressEvent {
  step: 'cloning' | 'clone-complete' | 'creating-instance' | 'instance-created' | 'registering-project' | 'complete' | 'error';
  message: string;
  sessionId?: string;
  error?: string;
}

// Smart Todos: Auto-Dispatch types
export interface DispatchTarget {
  type: 'instance' | 'new-instance' | 'none';
  instanceId?: string;
  newInstanceName?: string;
  workingDir?: string;
}

export interface CreateAndDispatchRequest {
  sessionId: string;
  todos: Array<{
    parsedTodoId: string;
    text: string;
    projectId: string;
    dispatchTarget: DispatchTarget;
  }>;
}

export interface CreateAndDispatchResult {
  todoId: string;
  status: 'created' | 'dispatched' | 'error';
  error?: string;
  instanceId?: string;
}

export interface CreateAndDispatchResponse {
  created: number;
  dispatched: number;
  newInstances: Array<{ id: string; name: string }>;
  results: CreateAndDispatchResult[];
}

export interface ProjectInstanceInfo {
  id: string;
  name: string;
  status: InstanceStatus;
  workingDir: string;
}
