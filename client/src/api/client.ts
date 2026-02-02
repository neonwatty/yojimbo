import type {
  Instance,
  CreateInstanceRequest,
  UpdateInstanceRequest,
  ReorderInstancesRequest,
  Session,
  SessionMessage,
  Plan,
  CreatePlanRequest,
  UpdatePlanRequest,
  Mockup,
  ApiResponse,
  PaginatedResponse,
  Settings,
  DirectoryListResponse,
  HomePathResponse,
  ClaudeCliStatus,
  ActivityEvent,
  ActivityFeedStats,
  GenerateSummaryRequest,
  GenerateSummaryResponse,
  RemoteMachine,
  CreateMachineRequest,
  UpdateMachineRequest,
  SSHKey,
  PortForward,
  InstancePorts,
  InstanceHtmlFiles,
  HtmlFile,
  GlobalTodo,
  TodoStats,
  CreateTodoRequest,
  UpdateTodoRequest,
  DispatchTodoRequest,
  ReorderTodosRequest,
  Release,
  Project,
  CreateProjectRequest,
  ParsedTodosResponse,
  SetupProjectRequest,
  SetupProjectResponse,
  ValidatePathResponse,
  ProjectInstanceInfo,
  CreateAndDispatchRequest,
  CreateAndDispatchResponse,
} from '@cc-orchestrator/shared';
import { toast } from '../store/toastStore';

const API_BASE = '/api';

interface RequestOptions extends RequestInit {
  silent?: boolean; // Don't show toast on error
}

async function request<T>(url: string, options?: RequestOptions): Promise<T> {
  const { silent, ...fetchOptions } = options || {};

  try {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions?.headers,
      },
      ...fetchOptions,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error || 'Request failed';
      if (!silent) {
        toast.error(errorMessage);
      }
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    // Network errors (fetch failed, no connection, etc.)
    if (error instanceof TypeError && !silent) {
      toast.error('Network error - check your connection');
    }
    throw error;
  }
}

// Instance API
export const instancesApi = {
  list: () => request<ApiResponse<Instance[]>>('/instances'),

  get: (id: string) => request<ApiResponse<Instance>>(`/instances/${id}`),

  create: (data: CreateInstanceRequest) =>
    request<ApiResponse<Instance>>('/instances', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateInstanceRequest) =>
    request<ApiResponse<Instance>>(`/instances/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  close: (id: string) =>
    request<ApiResponse<void>>(`/instances/${id}`, {
      method: 'DELETE',
    }),

  reorder: (data: ReorderInstancesRequest) =>
    request<ApiResponse<void>>('/instances/reorder', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendInput: (id: string, data: string) =>
    request<ApiResponse<void>>(`/instances/${id}/input`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),

  installHooks: (id: string, orchestratorUrl: string) =>
    request<ApiResponse<{
      message: string;
      tunnelActive?: boolean;
      tunnelPort?: number;
      tunnelShared?: boolean;
      tunnelError?: string;
      warning?: string;
    }>>(`/instances/${id}/install-hooks`, {
      method: 'POST',
      body: JSON.stringify({ orchestratorUrl }),
    }),

  checkHooks: (id: string) =>
    request<ApiResponse<{ existingHooks: string[] }>>(`/instances/${id}/check-hooks`),

  uninstallHooks: (id: string) =>
    request<ApiResponse<{ message: string }>>(`/instances/${id}/uninstall-hooks`, {
      method: 'POST',
    }),

  resetStatus: (id: string) =>
    request<ApiResponse<{ status: string }>>(`/instances/${id}/reset-status`, {
      method: 'POST',
    }),

  getHooksConfig: (id: string, orchestratorUrl: string) =>
    request<ApiResponse<{
      config: object;
      configJson: string;
      instructions: string[];
    }>>(`/instances/${id}/hooks-config?orchestratorUrl=${encodeURIComponent(orchestratorUrl)}`),

  getListeningPorts: (id: string, refresh = false) =>
    request<ApiResponse<InstancePorts>>(`/instances/${id}/listening-ports${refresh ? '?refresh=true' : ''}`),
};

// Session API
export const sessionsApi = {
  list: (page = 1, pageSize = 20) =>
    request<ApiResponse<PaginatedResponse<Session>>>(`/sessions?page=${page}&pageSize=${pageSize}`),

  search: (query: string) =>
    request<ApiResponse<Session[]>>(`/sessions/search?q=${encodeURIComponent(query)}`),

  listByDirectory: (path: string) =>
    request<ApiResponse<Session[]>>(`/sessions/by-directory?path=${encodeURIComponent(path)}`),

  get: (id: string) => request<ApiResponse<Session>>(`/sessions/${id}`),

  getMessages: (id: string, page = 1, pageSize = 50) =>
    request<ApiResponse<PaginatedResponse<SessionMessage>>>(`/sessions/${id}/messages?page=${page}&pageSize=${pageSize}`),
};

// Plans API
export const plansApi = {
  list: (workingDir: string) =>
    request<ApiResponse<Plan[]>>(`/plans?workingDir=${encodeURIComponent(workingDir)}`),

  get: (id: string) =>
    request<ApiResponse<Plan>>(`/plans/${encodeURIComponent(id)}`),

  create: (data: CreatePlanRequest) =>
    request<ApiResponse<Plan>>('/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdatePlanRequest) =>
    request<ApiResponse<Plan>>(`/plans/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>(`/plans/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  init: (workingDir: string) =>
    request<ApiResponse<{ created: boolean }>>('/plans/init', {
      method: 'POST',
      body: JSON.stringify({ workingDir }),
    }),
};

// Mockups API
export const mockupsApi = {
  list: (workingDir: string) =>
    request<ApiResponse<Mockup[]>>(`/mockups?workingDir=${encodeURIComponent(workingDir)}`),

  get: (id: string) =>
    request<ApiResponse<Mockup>>(`/mockups/${encodeURIComponent(id)}`),

  init: (workingDir: string) =>
    request<ApiResponse<{ created: boolean }>>('/mockups/init', {
      method: 'POST',
      body: JSON.stringify({ workingDir }),
    }),
};

// Settings API
export const settingsApi = {
  get: () => request<ApiResponse<Settings>>('/settings'),

  update: (data: Partial<Settings>) =>
    request<ApiResponse<Settings>>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  resetDatabase: () =>
    request<ApiResponse<{ reset: boolean }>>('/settings/reset-database', {
      method: 'POST',
    }),

  resetInstanceStatus: () =>
    request<ApiResponse<{ reset: boolean; count: number }>>('/settings/reset-instance-status', {
      method: 'POST',
    }),

  installLocalHooks: (serverUrl?: string) =>
    request<ApiResponse<{ installed: boolean; message: string }>>('/settings/install-local-hooks', {
      method: 'POST',
      body: JSON.stringify({ serverUrl }),
    }),

  checkLocalHooks: () =>
    request<ApiResponse<{ installed: boolean; hookTypes: string[] }>>('/settings/check-local-hooks'),
};

// Filesystem API
export const filesystemApi = {
  list: (path = '~') =>
    request<ApiResponse<DirectoryListResponse>>(`/filesystem/list?path=${encodeURIComponent(path)}`),

  home: () => request<ApiResponse<HomePathResponse>>('/filesystem/home'),

  claudeStatus: () => request<ApiResponse<ClaudeCliStatus>>('/filesystem/claude-status'),
};

// Feed API
export const feedApi = {
  list: (limit = 50, offset = 0) =>
    request<ApiResponse<ActivityEvent[]>>(`/feed?limit=${limit}&offset=${offset}`),

  getStats: () => request<ApiResponse<ActivityFeedStats>>('/feed/stats'),

  markAsRead: (id: string) =>
    request<ApiResponse<ActivityEvent>>(`/feed/${id}/read`, {
      method: 'PATCH',
    }),

  markAllAsRead: () =>
    request<ApiResponse<{ count: number }>>('/feed/mark-all-read', {
      method: 'POST',
    }),

  clear: () =>
    request<ApiResponse<{ count: number }>>('/feed/clear', {
      method: 'DELETE',
    }),
};

// Summaries API
export const summariesApi = {
  generate: (data: GenerateSummaryRequest) =>
    request<ApiResponse<GenerateSummaryResponse>>('/summaries/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Machines API
export const machinesApi = {
  list: () => request<ApiResponse<RemoteMachine[]>>('/machines'),

  get: (id: string) => request<ApiResponse<RemoteMachine>>(`/machines/${id}`),

  create: (data: CreateMachineRequest) =>
    request<ApiResponse<RemoteMachine>>('/machines', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateMachineRequest) =>
    request<ApiResponse<RemoteMachine>>(`/machines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>(`/machines/${id}`, {
      method: 'DELETE',
    }),

  testConnection: (id: string, options?: { silent?: boolean }) =>
    request<ApiResponse<{ connected: boolean; error?: string; machine: RemoteMachine }>>(
      `/machines/${id}/test`,
      { method: 'POST', silent: options?.silent }
    ),

  listDirectories: (id: string, path = '~') =>
    request<ApiResponse<{ path: string; directories: string[] }>>(
      `/machines/${id}/directories?path=${encodeURIComponent(path)}`
    ),

  testTunnel: (id: string) =>
    request<ApiResponse<{ active: boolean; message: string }>>(
      `/machines/${id}/test-tunnel`,
      { method: 'POST' }
    ),

  checkClaudeStatus: (id: string) =>
    request<ApiResponse<{ installed: boolean; path: string | null; version: string | null }>>(
      `/machines/${id}/claude-status`
    ),

  installHooks: (id: string, orchestratorUrl: string) =>
    request<ApiResponse<{ message: string; error?: string }>>(
      `/machines/${id}/install-hooks`,
      {
        method: 'POST',
        body: JSON.stringify({ orchestratorUrl }),
      }
    ),

  checkHooksStatus: (id: string) =>
    request<ApiResponse<{ installed: boolean; hookTypes: string[]; error?: string }>>(
      `/machines/${id}/hooks-status`
    ),

  // Machine-level keychain unlock
  unlockKeychain: (id: string) =>
    request<ApiResponse<{ unlocked?: boolean; alreadyUnlocked?: boolean; message: string }>>(
      `/machines/${id}/unlock-keychain`,
      { method: 'POST' }
    ),

  getKeychainStatus: (id: string) =>
    request<ApiResponse<{ unlocked: boolean; message: string }>>(
      `/machines/${id}/keychain-status`
    ),

  // Preflight checks
  runPreflight: (id: string) =>
    request<ApiResponse<import('@cc-orchestrator/shared').PreflightResult>>(
      `/machines/${id}/preflight`,
      { method: 'POST' }
    ),

  runQuickPreflight: (id: string) =>
    request<ApiResponse<import('@cc-orchestrator/shared').PreflightResult>>(
      `/machines/${id}/preflight/quick`
    ),
};

// SSH API
export const sshApi = {
  listKeys: () => request<ApiResponse<SSHKey[]>>('/ssh/keys'),
};

// Port Forwards API
export const portForwardsApi = {
  list: (instanceId: string) =>
    request<ApiResponse<PortForward[]>>(`/instances/${instanceId}/ports`),

  create: (instanceId: string, data: { remotePort: number; localPort?: number }) =>
    request<ApiResponse<PortForward>>(`/instances/${instanceId}/ports`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  close: (instanceId: string, portId: string) =>
    request<ApiResponse<void>>(`/instances/${instanceId}/ports/${portId}`, {
      method: 'DELETE',
    }),

  reconnect: (instanceId: string, portId: string) =>
    request<ApiResponse<PortForward>>(`/instances/${instanceId}/ports/${portId}/reconnect`, {
      method: 'POST',
    }),
};

// Keychain API (macOS only)
export const keychainApi = {
  // Local keychain operations
  unlock: (password: string) =>
    request<ApiResponse<{ message: string }>>('/keychain/unlock', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  status: () =>
    request<ApiResponse<{ locked: boolean; message: string }>>('/keychain/status'),

  // Local keychain auto-unlock (stores password for server startup)
  saveLocalPassword: (password: string) =>
    request<ApiResponse<{ message: string }>>('/keychain/local/save', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  hasLocalPassword: () =>
    request<ApiResponse<{ hasPassword: boolean }>>('/keychain/local/has-password'),

  deleteLocalPassword: () =>
    request<ApiResponse<{ message: string }>>('/keychain/local', {
      method: 'DELETE',
    }),

  testLocalUnlock: (password: string) =>
    request<ApiResponse<{ message: string }>>('/keychain/local/test-unlock', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // Remote keychain password storage (stores in LOCAL keychain)
  saveRemotePassword: (machineId: string, password: string) =>
    request<ApiResponse<{ message: string }>>(`/keychain/remote/${machineId}/save`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  hasRemotePassword: (machineId: string) =>
    request<ApiResponse<{ hasPassword: boolean }>>(`/keychain/remote/${machineId}/has-password`),

  deleteRemotePassword: (machineId: string) =>
    request<ApiResponse<{ message: string }>>(`/keychain/remote/${machineId}`, {
      method: 'DELETE',
    }),

  autoUnlockRemote: (instanceId: string) =>
    request<ApiResponse<{ message: string }>>(`/keychain/remote/${instanceId}/auto-unlock`, {
      method: 'POST',
    }),

  testRemotePassword: (machineId: string, password: string) =>
    request<ApiResponse<{ valid: boolean; message: string }>>(`/keychain/remote/${machineId}/test`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
};

// Todos API
export const todosApi = {
  list: (includeArchived = false) =>
    request<ApiResponse<GlobalTodo[]>>(`/todos?includeArchived=${includeArchived}`),

  get: (id: string) => request<ApiResponse<GlobalTodo>>(`/todos/${id}`),

  getStats: () => request<ApiResponse<TodoStats>>('/todos/stats'),

  create: (data: CreateTodoRequest) =>
    request<ApiResponse<GlobalTodo>>('/todos', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateTodoRequest) =>
    request<ApiResponse<GlobalTodo>>(`/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>(`/todos/${id}`, {
      method: 'DELETE',
    }),

  dispatch: (id: string, data: DispatchTodoRequest) =>
    request<ApiResponse<GlobalTodo | { text: string }>>(`/todos/${id}/dispatch`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  markDone: (id: string) =>
    request<ApiResponse<GlobalTodo>>(`/todos/${id}/done`, {
      method: 'POST',
    }),

  archive: (id: string) =>
    request<ApiResponse<GlobalTodo>>(`/todos/${id}/archive`, {
      method: 'POST',
    }),

  reorder: (data: ReorderTodosRequest) =>
    request<ApiResponse<void>>('/todos/reorder', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// HTML Files API
export const htmlFilesApi = {
  list: (instanceId: string) =>
    request<ApiResponse<InstanceHtmlFiles>>(`/instances/${instanceId}/html-files`),

  add: (instanceId: string, path: string) =>
    request<ApiResponse<HtmlFile>>(`/instances/${instanceId}/html-files`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  remove: (instanceId: string, fileId: string) =>
    request<ApiResponse<void>>(`/instances/${instanceId}/html-files/${fileId}`, {
      method: 'DELETE',
    }),

  getContent: (instanceId: string, fileId: string) =>
    request<ApiResponse<{ content: string }>>(`/instances/${instanceId}/html-files/${fileId}/content`),

  upload: (instanceId: string, fileName: string, content: string) =>
    request<ApiResponse<HtmlFile>>(`/instances/${instanceId}/html-files/upload`, {
      method: 'POST',
      body: JSON.stringify({ fileName, content }),
    }),
};

// Releases API
export const releasesApi = {
  list: () => request<ApiResponse<Release[]>>('/releases'),
};

// Projects API
export const projectsApi = {
  list: () => request<ApiResponse<Project[]>>('/projects'),

  get: (id: string) => request<ApiResponse<Project>>(`/projects/${id}`),

  create: (data: CreateProjectRequest) =>
    request<ApiResponse<Project>>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  ensure: (path: string, name?: string) =>
    request<ApiResponse<Project>>('/projects/ensure', {
      method: 'POST',
      body: JSON.stringify({ path, name }),
    }),

  delete: (id: string) =>
    request<ApiResponse<void>>(`/projects/${id}`, {
      method: 'DELETE',
    }),

  getInstances: (projectId: string) =>
    request<ApiResponse<{ instances: ProjectInstanceInfo[] }>>(`/projects/${projectId}/instances`),
};

// Smart Todos API response types
export interface SmartTodosStatusResponse {
  available: boolean;
  message: string;
}

export interface SmartTodosParseResponse extends ParsedTodosResponse {
  sessionId: string;
  needsClarification: boolean;
  summary: {
    totalTodos: number;
    routableCount: number;
    needsClarificationCount: number;
    estimatedCost: string;
  };
}

export interface SmartTodosSessionResponse {
  sessionId: string;
  input: string;
  todos: ParsedTodosResponse;
  clarificationRound: number;
  createdAt: string;
  summary: {
    totalTodos: number;
    routableCount: number;
    needsClarificationCount: number;
  };
}

// Smart Todos API
export const smartTodosApi = {
  status: () =>
    request<ApiResponse<SmartTodosStatusResponse>>('/smart-todos/status'),

  parse: (input: string) =>
    request<ApiResponse<SmartTodosParseResponse>>('/smart-todos/parse', {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),

  clarify: (sessionId: string, clarification: string) =>
    request<ApiResponse<SmartTodosParseResponse>>('/smart-todos/clarify', {
      method: 'POST',
      body: JSON.stringify({ sessionId, clarification }),
    }),

  getSession: (sessionId: string) =>
    request<ApiResponse<SmartTodosSessionResponse>>(`/smart-todos/session/${sessionId}`),

  clearSession: (sessionId: string) =>
    request<ApiResponse<void>>(`/smart-todos/session/${sessionId}`, {
      method: 'DELETE',
    }),

  validate: (todos: ParsedTodosResponse) =>
    request<ApiResponse<{
      valid: boolean;
      issues: string[];
      routableTodos: ParsedTodosResponse['todos'];
    }>>('/smart-todos/validate', {
      method: 'POST',
      body: JSON.stringify({ todos }),
    }),

  validatePath: (path: string) =>
    request<ApiResponse<ValidatePathResponse>>('/smart-todos/validate-path', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  expandPath: (path: string) =>
    request<ApiResponse<{ expandedPath: string }>>('/smart-todos/expand-path', {
      method: 'POST',
      body: JSON.stringify({ path }),
    }),

  setupProject: (data: SetupProjectRequest) =>
    request<ApiResponse<SetupProjectResponse>>('/smart-todos/setup-project', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createAndDispatch: (data: CreateAndDispatchRequest) =>
    request<ApiResponse<CreateAndDispatchResponse>>('/smart-todos/create-and-dispatch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
