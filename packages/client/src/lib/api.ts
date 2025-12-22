import type { Instance, Session, StatusEvent, HealthResponse } from '@cc-orchestrator/shared';

const API_BASE = 'http://localhost:3001';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Health
export const api = {
  // Health check
  health: () => fetchJson<HealthResponse>('/api/health'),

  // Instances
  instances: {
    list: () => fetchJson<Instance[]>('/api/instances'),
    get: (id: string) => fetchJson<Instance>(`/api/instances/${id}`),
    create: (data: { name: string; workingDir: string }) =>
      fetchJson<Instance>('/api/instances', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Instance>) =>
      fetchJson<Instance>(`/api/instances/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>(`/api/instances/${id}`, {
        method: 'DELETE',
      }),
  },

  // Sessions
  sessions: {
    list: (instanceId?: string) => {
      const params = instanceId ? `?instanceId=${instanceId}` : '';
      return fetchJson<Session[]>(`/api/sessions${params}`);
    },
    get: (id: string) => fetchJson<Session>(`/api/sessions/${id}`),
    create: (data: { instanceId?: string; name: string; workingDir: string }) =>
      fetchJson<Session>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Session>) =>
      fetchJson<Session>(`/api/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchJson<{ success: boolean }>(`/api/sessions/${id}`, {
        method: 'DELETE',
      }),
  },

  // Status events
  statusEvents: {
    list: (instanceId?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (instanceId) params.append('instanceId', instanceId);
      if (limit) params.append('limit', String(limit));
      const query = params.toString() ? `?${params}` : '';
      return fetchJson<StatusEvent[]>(`/api/status-events${query}`);
    },
    forInstance: (instanceId: string, limit = 50) =>
      fetchJson<StatusEvent[]>(`/api/instances/${instanceId}/status-events?limit=${limit}`),
    latest: () => fetchJson<StatusEvent[]>('/api/status-events/latest'),
  },
};
