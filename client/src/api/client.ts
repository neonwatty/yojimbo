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
  Note,
  CreateNoteRequest,
  UpdateNoteRequest,
  ApiResponse,
  PaginatedResponse,
  Settings,
} from '@cc-orchestrator/shared';

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
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

  sendInput: (id: string, input: string) =>
    request<ApiResponse<void>>(`/instances/${id}/input`, {
      method: 'POST',
      body: JSON.stringify({ input }),
    }),
};

// Session API
export const sessionsApi = {
  list: (page = 1, pageSize = 20) =>
    request<ApiResponse<PaginatedResponse<Session>>>(`/sessions?page=${page}&pageSize=${pageSize}`),

  search: (query: string) =>
    request<ApiResponse<Session[]>>(`/sessions/search?q=${encodeURIComponent(query)}`),

  get: (id: string) => request<ApiResponse<Session>>(`/sessions/${id}`),

  getMessages: (id: string, page = 1, pageSize = 50) =>
    request<ApiResponse<PaginatedResponse<SessionMessage>>>(`/sessions/${id}/messages?page=${page}&pageSize=${pageSize}`),
};

// Plans API
export const plansApi = {
  list: (workingDir: string) =>
    request<ApiResponse<Plan[]>>(`/plans?workingDir=${encodeURIComponent(workingDir)}`),

  get: (path: string) =>
    request<ApiResponse<Plan>>(`/plans/${encodeURIComponent(path)}`),

  create: (data: CreatePlanRequest) =>
    request<ApiResponse<Plan>>('/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (path: string, data: UpdatePlanRequest) =>
    request<ApiResponse<Plan>>(`/plans/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (path: string) =>
    request<ApiResponse<void>>(`/plans/${encodeURIComponent(path)}`, {
      method: 'DELETE',
    }),
};

// Notes API
export const notesApi = {
  list: (workingDir: string) =>
    request<ApiResponse<Note[]>>(`/notes?workingDir=${encodeURIComponent(workingDir)}`),

  get: (path: string) =>
    request<ApiResponse<Note>>(`/notes/${encodeURIComponent(path)}`),

  create: (data: CreateNoteRequest) =>
    request<ApiResponse<Note>>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (path: string, data: UpdateNoteRequest) =>
    request<ApiResponse<Note>>(`/notes/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (path: string) =>
    request<ApiResponse<void>>(`/notes/${encodeURIComponent(path)}`, {
      method: 'DELETE',
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
};
