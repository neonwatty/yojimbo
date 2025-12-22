import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Plan, PlanFile, PlansListResponse } from '@cc-orchestrator/shared';

const API_BASE = 'http://localhost:3001';

// Fetch plans list for a working directory
async function fetchPlans(workingDir: string): Promise<PlansListResponse> {
  const response = await fetch(
    `${API_BASE}/api/plans?workingDir=${encodeURIComponent(workingDir)}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch plans');
  }
  return response.json();
}

// Fetch a single plan
async function fetchPlan(planId: string, workingDir: string): Promise<Plan> {
  const response = await fetch(
    `${API_BASE}/api/plans/${planId}?workingDir=${encodeURIComponent(workingDir)}`
  );
  if (!response.ok) {
    throw new Error('Failed to fetch plan');
  }
  return response.json();
}

// Create a new plan
async function createPlan(data: {
  workingDir: string;
  name: string;
  content?: string;
}): Promise<PlanFile> {
  const response = await fetch(`${API_BASE}/api/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create plan');
  }
  return response.json();
}

// Update a plan
async function updatePlan(data: {
  planId: string;
  workingDir: string;
  content: string;
}): Promise<PlanFile> {
  const response = await fetch(`${API_BASE}/api/plans/${data.planId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workingDir: data.workingDir, content: data.content }),
  });
  if (!response.ok) {
    throw new Error('Failed to update plan');
  }
  return response.json();
}

// Delete a plan
async function deletePlan(data: { planId: string; workingDir: string }): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/plans/${data.planId}?workingDir=${encodeURIComponent(data.workingDir)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) {
    throw new Error('Failed to delete plan');
  }
}

// Hook: List plans
export function usePlans(workingDir: string | undefined) {
  return useQuery({
    queryKey: ['plans', workingDir],
    queryFn: () => fetchPlans(workingDir!),
    enabled: !!workingDir,
  });
}

// Hook: Get single plan
export function usePlan(planId: string | undefined, workingDir: string | undefined) {
  return useQuery({
    queryKey: ['plan', planId, workingDir],
    queryFn: () => fetchPlan(planId!, workingDir!),
    enabled: !!planId && !!workingDir,
  });
}

// Hook: Create plan
export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPlan,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans', variables.workingDir] });
    },
  });
}

// Hook: Update plan
export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updatePlan,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans', variables.workingDir] });
      queryClient.invalidateQueries({ queryKey: ['plan', variables.planId, variables.workingDir] });
    },
  });
}

// Hook: Delete plan
export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlan,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans', variables.workingDir] });
    },
  });
}
