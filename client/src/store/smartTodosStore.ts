import { create } from 'zustand';
import type { ParsedTodo, ParsedTodosResponse, Project, DispatchTarget, ProjectInstanceInfo } from '@cc-orchestrator/shared';

export type SmartTodosState = 'idle' | 'parsing' | 'parsed' | 'clarifying' | 'error';
export type DispatchState = 'idle' | 'dispatching' | 'complete' | 'error';

interface SmartTodosStoreState {
  // Feature availability
  isAvailable: boolean;
  availabilityMessage: string;

  // Current state
  state: SmartTodosState;
  errorMessage: string | null;

  // Input
  rawInput: string;

  // Parsed results
  sessionId: string | null;
  parsedTodos: ParsedTodo[];
  suggestedOrder: string[];
  needsClarification: boolean;

  // Summary info
  summary: {
    totalTodos: number;
    routableCount: number;
    needsClarificationCount: number;
    estimatedCost: string;
  } | null;

  // Projects for matching
  projects: Project[];

  // Dispatch state
  dispatchTargets: Record<string, DispatchTarget>;      // todoId → target
  projectInstancesCache: Record<string, ProjectInstanceInfo[]>; // projectId → instances
  dispatchState: DispatchState;

  // Actions
  setAvailability: (available: boolean, message: string) => void;
  setRawInput: (input: string) => void;
  startParsing: () => void;
  setParsedResult: (
    sessionId: string,
    todos: ParsedTodosResponse,
    needsClarification: boolean,
    summary: SmartTodosStoreState['summary']
  ) => void;
  startClarifying: () => void;
  setError: (message: string) => void;
  updateTodo: (todoId: string, updates: Partial<ParsedTodo>) => void;
  removeTodo: (todoId: string) => void;
  selectProjectForTodo: (todoId: string, projectId: string) => void;
  setProjects: (projects: Project[]) => void;
  reset: () => void;

  // Dispatch actions
  setDispatchTarget: (todoId: string, target: DispatchTarget) => void;
  setProjectInstances: (projectId: string, instances: ProjectInstanceInfo[]) => void;
  computeSmartDefaults: () => void;
  startDispatching: () => void;
  setDispatchComplete: () => void;
  setDispatchError: (message: string) => void;
}

const initialState = {
  isAvailable: false,
  availabilityMessage: 'Checking availability...',
  state: 'idle' as SmartTodosState,
  errorMessage: null,
  rawInput: '',
  sessionId: null,
  parsedTodos: [],
  suggestedOrder: [],
  needsClarification: false,
  summary: null,
  projects: [],
  // Dispatch state
  dispatchTargets: {} as Record<string, DispatchTarget>,
  projectInstancesCache: {} as Record<string, ProjectInstanceInfo[]>,
  dispatchState: 'idle' as DispatchState,
};

export const useSmartTodosStore = create<SmartTodosStoreState>()((set) => ({
  ...initialState,

  setAvailability: (available, message) =>
    set({ isAvailable: available, availabilityMessage: message }),

  setRawInput: (input) => set({ rawInput: input }),

  startParsing: () =>
    set({ state: 'parsing', errorMessage: null }),

  setParsedResult: (sessionId, todos, needsClarification, summary) =>
    set({
      state: 'parsed',
      sessionId,
      parsedTodos: todos.todos,
      suggestedOrder: todos.suggestedOrder,
      needsClarification,
      summary,
      errorMessage: null,
    }),

  startClarifying: () => set({ state: 'clarifying' }),

  setError: (message) =>
    set({ state: 'error', errorMessage: message }),

  updateTodo: (todoId, updates) =>
    set((state) => ({
      parsedTodos: state.parsedTodos.map((todo) =>
        todo.id === todoId ? { ...todo, ...updates } : todo
      ),
    })),

  removeTodo: (todoId) =>
    set((state) => ({
      parsedTodos: state.parsedTodos.filter((todo) => todo.id !== todoId),
      suggestedOrder: state.suggestedOrder.filter((id) => id !== todoId),
    })),

  selectProjectForTodo: (todoId, projectId) =>
    set((state) => ({
      parsedTodos: state.parsedTodos.map((todo) => {
        if (todo.id !== todoId) return todo;

        // Find confidence from projectMatches if available
        const match = todo.projectMatches?.find((m) => m.projectId === projectId);
        const newConfidence = match?.confidence ?? todo.projectConfidence;

        // Update clarity: if new confidence >= 0.7 and we have a project, it's clear
        const newClarity = newConfidence >= 0.7 && projectId
          ? 'clear'
          : todo.clarity === 'unknown_project' && projectId
            ? 'clear'
            : todo.clarity;

        return {
          ...todo,
          projectId,
          projectConfidence: newConfidence,
          clarity: newClarity,
          // Clear clarification if now clear
          clarificationNeeded: newClarity === 'clear' ? undefined : todo.clarificationNeeded,
        };
      }),
    })),

  setProjects: (projects) => set({ projects }),

  reset: () => set(initialState),

  // Dispatch actions
  setDispatchTarget: (todoId, target) =>
    set((state) => ({
      dispatchTargets: {
        ...state.dispatchTargets,
        [todoId]: target,
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

      for (const todo of state.parsedTodos) {
        // Skip todos that already have a dispatch target set
        if (state.dispatchTargets[todo.id]) {
          newTargets[todo.id] = state.dispatchTargets[todo.id];
          continue;
        }

        // Skip todos without a project
        if (!todo.projectId) {
          newTargets[todo.id] = { type: 'none' };
          continue;
        }

        // Get instances for this project
        const instances = state.projectInstancesCache[todo.projectId] || [];

        // Find an idle instance first (preferred)
        const idleInstance = instances.find((i) => i.status === 'idle');
        if (idleInstance) {
          newTargets[todo.id] = {
            type: 'instance',
            instanceId: idleInstance.id,
          };
          continue;
        }

        // Fall back to first busy instance (will queue)
        const busyInstance = instances.find((i) => i.status === 'working');
        if (busyInstance) {
          newTargets[todo.id] = {
            type: 'instance',
            instanceId: busyInstance.id,
          };
          continue;
        }

        // No instances available - default to create new
        const project = state.projects.find((p) => p.id === todo.projectId);
        newTargets[todo.id] = {
          type: 'new-instance',
          newInstanceName: `${project?.name || 'project'}-todo`,
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

// Helper to derive effective clarity from todo state
// This ensures we don't trust the parser blindly - if projectId is null, it's unknown_project
export const getEffectiveClarity = (todo: ParsedTodo): ParsedTodo['clarity'] => {
  // If no project is assigned, it's always unknown_project regardless of what parser said
  if (todo.projectId === null) {
    return 'unknown_project';
  }
  // If we have a project but low confidence, it's ambiguous
  if (todo.projectConfidence < 0.7) {
    return 'ambiguous';
  }
  // Otherwise trust the parser's clarity (could be 'clear' or 'ambiguous')
  return todo.clarity;
};

// Selectors
export const selectTodosNeedingClarification = (state: SmartTodosStoreState) =>
  state.parsedTodos.filter(
    (todo) => getEffectiveClarity(todo) !== 'clear' || todo.clarificationNeeded
  );

export const selectRoutableTodos = (state: SmartTodosStoreState) =>
  state.parsedTodos.filter(
    (todo) => getEffectiveClarity(todo) === 'clear' && todo.projectId !== null
  );

export const selectTodoById = (state: SmartTodosStoreState, todoId: string) =>
  state.parsedTodos.find((todo) => todo.id === todoId);
