// Instance status types
export type InstanceStatus = 'working' | 'awaiting' | 'idle' | 'error';

// Instance type
export interface Instance {
  id: string;
  name: string;
  status: InstanceStatus;
  pinned: boolean;
  workingDir: string;
  createdAt: string;
  updatedAt: string;
}

// User preferences
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  terminalFontSize: number;
  terminalFontFamily: string;
}

// API response types
export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

// WebSocket message types
export type WSMessageType =
  | 'terminal-output'
  | 'terminal-resize'
  | 'instance-status'
  | 'plans-changed';

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  payload: T;
}
