import { create } from 'zustand';
import type { GlobalTask, TaskStats } from '@cc-orchestrator/shared';

interface TasksState {
  tasks: GlobalTask[];
  stats: TaskStats;
  isLoading: boolean;

  setTasks: (tasks: GlobalTask[]) => void;
  addTask: (task: GlobalTask) => void;
  updateTask: (id: string, updates: Partial<GlobalTask>) => void;
  removeTask: (id: string) => void;
  reorderTasks: (taskIds: string[]) => void;
  setStats: (stats: TaskStats) => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const useTasksStore = create<TasksState>()((set) => ({
  tasks: [],
  stats: { total: 0, captured: 0, inProgress: 0, done: 0 },
  isLoading: false,

  setTasks: (tasks) => set({ tasks }),

  addTask: (task) =>
    set((state) => ({
      tasks: [...state.tasks, task],
      stats: {
        ...state.stats,
        total: state.stats.total + 1,
        captured: state.stats.captured + 1,
      },
    })),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      ),
    })),

  removeTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    })),

  reorderTasks: (taskIds) =>
    set((state) => {
      const taskMap = new Map(state.tasks.map((t) => [t.id, t]));
      const reordered = taskIds
        .map((id) => taskMap.get(id))
        .filter((t): t is GlobalTask => t !== undefined);
      // Add any tasks not in taskIds at the end
      const remainingTasks = state.tasks.filter((t) => !taskIds.includes(t.id));
      return { tasks: [...reordered, ...remainingTasks] };
    }),

  setStats: (stats) => set({ stats }),

  setIsLoading: (isLoading) => set({ isLoading }),
}));
