import { create } from 'zustand';
import type { ParsedTask, ParsedTasksResponse, Project, DispatchTarget, ProjectInstanceInfo } from '@cc-orchestrator/shared';

export type SmartTasksState = 'idle' | 'parsing' | 'parsed' | 'clarifying' | 'error';
export type DispatchState = 'idle' | 'dispatching' | 'complete' | 'error';

interface SmartTasksStoreState {
  // Feature availability
  isAvailable: boolean;
  availabilityMessage: string;

  // Current state
  state: SmartTasksState;
  errorMessage: string | null;

  // Input
  rawInput: string;

  // Parsed results
  sessionId: string | null;
  parsedTasks: ParsedTask[];
  suggestedOrder: string[];
  needsClarification: boolean;

  // Summary info
  summary: {
    totalTasks: number;
    routableCount: number;
    needsClarificationCount: number;
    estimatedCost: string;
  } | null;

  // Projects for matching
  projects: Project[];

  // Dispatch state (new)
  dispatchTargets: Record<string, DispatchTarget>;      // taskId → target
  projectInstancesCache: Record<string, ProjectInstanceInfo[]>; // projectId → instances
  dispatchState: DispatchState;

  // Actions
  setAvailability: (available: boolean, message: string) => void;
  setRawInput: (input: string) => void;
  startParsing: () => void;
  setParsedResult: (
    sessionId: string,
    tasks: ParsedTasksResponse,
    needsClarification: boolean,
    summary: SmartTasksStoreState['summary']
  ) => void;
  startClarifying: () => void;
  setError: (message: string) => void;
  updateTask: (taskId: string, updates: Partial<ParsedTask>) => void;
  removeTask: (taskId: string) => void;
  selectProjectForTask: (taskId: string, projectId: string) => void;
  setProjects: (projects: Project[]) => void;
  reset: () => void;

  // Dispatch actions (new)
  setDispatchTarget: (taskId: string, target: DispatchTarget) => void;
  setProjectInstances: (projectId: string, instances: ProjectInstanceInfo[]) => void;
  computeSmartDefaults: () => void;
  startDispatching: () => void;
  setDispatchComplete: () => void;
  setDispatchError: (message: string) => void;
}

const initialState = {
  isAvailable: false,
  availabilityMessage: 'Checking availability...',
  state: 'idle' as SmartTasksState,
  errorMessage: null,
  rawInput: '',
  sessionId: null,
  parsedTasks: [],
  suggestedOrder: [],
  needsClarification: false,
  summary: null,
  projects: [],
  // Dispatch state (new)
  dispatchTargets: {} as Record<string, DispatchTarget>,
  projectInstancesCache: {} as Record<string, ProjectInstanceInfo[]>,
  dispatchState: 'idle' as DispatchState,
};

export const useSmartTasksStore = create<SmartTasksStoreState>()((set) => ({
  ...initialState,

  setAvailability: (available, message) =>
    set({ isAvailable: available, availabilityMessage: message }),

  setRawInput: (input) => set({ rawInput: input }),

  startParsing: () =>
    set({ state: 'parsing', errorMessage: null }),

  setParsedResult: (sessionId, tasks, needsClarification, summary) =>
    set({
      state: 'parsed',
      sessionId,
      parsedTasks: tasks.tasks,
      suggestedOrder: tasks.suggestedOrder,
      needsClarification,
      summary,
      errorMessage: null,
    }),

  startClarifying: () => set({ state: 'clarifying' }),

  setError: (message) =>
    set({ state: 'error', errorMessage: message }),

  updateTask: (taskId, updates) =>
    set((state) => ({
      parsedTasks: state.parsedTasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task
      ),
    })),

  removeTask: (taskId) =>
    set((state) => ({
      parsedTasks: state.parsedTasks.filter((task) => task.id !== taskId),
      suggestedOrder: state.suggestedOrder.filter((id) => id !== taskId),
    })),

  selectProjectForTask: (taskId, projectId) =>
    set((state) => ({
      parsedTasks: state.parsedTasks.map((task) => {
        if (task.id !== taskId) return task;

        // Find confidence from projectMatches if available
        const match = task.projectMatches?.find((m) => m.projectId === projectId);
        const newConfidence = match?.confidence ?? task.projectConfidence;

        // Update clarity: if new confidence >= 0.7 and we have a project, it's clear
        const newClarity = newConfidence >= 0.7 && projectId
          ? 'clear'
          : task.clarity === 'unknown_project' && projectId
            ? 'clear'
            : task.clarity;

        return {
          ...task,
          projectId,
          projectConfidence: newConfidence,
          clarity: newClarity,
          // Clear clarification if now clear
          clarificationNeeded: newClarity === 'clear' ? undefined : task.clarificationNeeded,
        };
      }),
    })),

  setProjects: (projects) => set({ projects }),

  reset: () => set(initialState),

  // Dispatch actions (new)
  setDispatchTarget: (taskId, target) =>
    set((state) => ({
      dispatchTargets: {
        ...state.dispatchTargets,
        [taskId]: target,
      },
    })),

  setProjectInstances: (projectId, instances) =>
    set((state) => ({
      projectInstancesCache: {
        ...state.projectInstancesCache,
        [projectId]: instances,
      },
    })),

  computeSmartDefaults: () =>
    set((state) => {
      const newTargets: Record<string, DispatchTarget> = {};

      for (const task of state.parsedTasks) {
        // Skip tasks that already have a dispatch target set
        if (state.dispatchTargets[task.id]) {
          newTargets[task.id] = state.dispatchTargets[task.id];
          continue;
        }

        // Skip tasks without a project
        if (!task.projectId) {
          newTargets[task.id] = { type: 'none' };
          continue;
        }

        // Get instances for this project
        const instances = state.projectInstancesCache[task.projectId] || [];

        // Find an idle instance first (preferred)
        const idleInstance = instances.find((i) => i.status === 'idle');
        if (idleInstance) {
          newTargets[task.id] = {
            type: 'instance',
            instanceId: idleInstance.id,
          };
          continue;
        }

        // Fall back to first busy instance (will queue)
        const busyInstance = instances.find((i) => i.status === 'working');
        if (busyInstance) {
          newTargets[task.id] = {
            type: 'instance',
            instanceId: busyInstance.id,
          };
          continue;
        }

        // No instances available - default to create new
        const project = state.projects.find((p) => p.id === task.projectId);
        newTargets[task.id] = {
          type: 'new-instance',
          newInstanceName: `${project?.name || 'project'}-task`,
          workingDir: project?.path,
        };
      }

      return { dispatchTargets: newTargets };
    }),

  startDispatching: () => set({ dispatchState: 'dispatching' }),

  setDispatchComplete: () => set({ dispatchState: 'complete' }),

  setDispatchError: (message) =>
    set({ dispatchState: 'error', errorMessage: message }),
}));

// Helper to derive effective clarity from task state
// This ensures we don't trust the parser blindly - if projectId is null, it's unknown_project
export const getEffectiveClarity = (task: ParsedTask): ParsedTask['clarity'] => {
  // If no project is assigned, it's always unknown_project regardless of what parser said
  if (task.projectId === null) {
    return 'unknown_project';
  }
  // If we have a project but low confidence, it's ambiguous
  if (task.projectConfidence < 0.7) {
    return 'ambiguous';
  }
  // Otherwise trust the parser's clarity (could be 'clear' or 'ambiguous')
  return task.clarity;
};

// Selectors
export const selectTasksNeedingClarification = (state: SmartTasksStoreState) =>
  state.parsedTasks.filter(
    (task) => getEffectiveClarity(task) !== 'clear' || task.clarificationNeeded
  );

export const selectRoutableTasks = (state: SmartTasksStoreState) =>
  state.parsedTasks.filter(
    (task) => getEffectiveClarity(task) === 'clear' && task.projectId !== null
  );

export const selectTaskById = (state: SmartTasksStoreState, taskId: string) =>
  state.parsedTasks.find((task) => task.id === taskId);
