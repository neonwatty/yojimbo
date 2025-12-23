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
  | 'error';

export interface WSServerMessage {
  type: WSServerMessageType;
  instanceId?: string;
  data?: string;
  instance?: Instance;
  status?: InstanceStatus;
  session?: Session;
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
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  terminalFontSize: number;
  terminalFontFamily: string;
  showWelcomeBanner: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  terminalFontSize: 14,
  terminalFontFamily: 'JetBrains Mono',
  showWelcomeBanner: true,
};
