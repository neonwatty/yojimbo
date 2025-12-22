import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Instance } from '@cc-orchestrator/shared';

export const instanceKeys = {
  all: ['instances'] as const,
  lists: () => [...instanceKeys.all, 'list'] as const,
  list: () => [...instanceKeys.lists()] as const,
  details: () => [...instanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...instanceKeys.details(), id] as const,
};

export function useInstances() {
  return useQuery({
    queryKey: instanceKeys.list(),
    queryFn: api.instances.list,
  });
}

export function useInstance(id: string) {
  return useQuery({
    queryKey: instanceKeys.detail(id),
    queryFn: () => api.instances.get(id),
    enabled: !!id,
  });
}

export function useCreateInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; workingDir: string }) => api.instances.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
    },
  });
}

export function useUpdateInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Instance> }) =>
      api.instances.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: instanceKeys.detail(id) });
    },
  });
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.instances.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instanceKeys.lists() });
    },
  });
}
