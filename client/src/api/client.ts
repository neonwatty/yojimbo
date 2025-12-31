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
} from '@cc-orchestrator/shared';
import { toast } from '../store/toastStore';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error || 'Request failed';
      toast.error(errorMessage);
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    // Network errors (fetch failed, no connection, etc.)
    if (error instanceof TypeError) {
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

  testConnection: (id: string) =>
    request<ApiResponse<{ connected: boolean; error?: string; machine: RemoteMachine }>>(
      `/machines/${id}/test`,
      { method: 'POST' }
    ),

  listDirectories: (id: string, path = '~') =>
    request<ApiResponse<{ path: string; directories: string[] }>>(
      `/machines/${id}/directories?path=${encodeURIComponent(path)}`
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
};
