import { create } from 'zustand';
import type { ParsedTask, ParsedTasksResponse, Project } from '@cc-orchestrator/shared';

export type SmartTasksState = 'idle' | 'parsing' | 'parsed' | 'clarifying' | 'error';

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
  setProjects: (projects: Project[]) => void;
  reset: () => void;
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

  setProjects: (projects) => set({ projects }),

  reset: () => set(initialState),
}));

// Selectors
export const selectTasksNeedingClarification = (state: SmartTasksStoreState) =>
  state.parsedTasks.filter(
    (task) => task.clarity !== 'clear' || task.clarificationNeeded
  );

export const selectRoutableTasks = (state: SmartTasksStoreState) =>
  state.parsedTasks.filter(
    (task) => task.clarity === 'clear' && task.projectId !== null
  );

export const selectTaskById = (state: SmartTasksStoreState, taskId: string) =>
  state.parsedTasks.find((task) => task.id === taskId);
