import { create } from 'zustand';
import type { GlobalTodo, TodoStats } from '@cc-orchestrator/shared';

interface TodosState {
  todos: GlobalTodo[];
  stats: TodoStats;
  isLoading: boolean;

  setTodos: (todos: GlobalTodo[]) => void;
  addTodo: (todo: GlobalTodo) => void;
  updateTodo: (id: string, updates: Partial<GlobalTodo>) => void;
  removeTodo: (id: string) => void;
  reorderTodos: (todoIds: string[]) => void;
  setStats: (stats: TodoStats) => void;
  setIsLoading: (isLoading: boolean) => void;
}

export const useTodosStore = create<TodosState>()((set) => ({
  todos: [],
  stats: { total: 0, captured: 0, inProgress: 0, done: 0 },
  isLoading: false,

  setTodos: (todos) => set({ todos }),

  addTodo: (todo) =>
    set((state) => ({
      todos: [...state.todos, todo],
      stats: {
        ...state.stats,
        total: state.stats.total + 1,
        captured: state.stats.captured + 1,
      },
    })),

  updateTodo: (id, updates) =>
    set((state) => ({
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, ...updates } : todo
      ),
    })),

  removeTodo: (id) =>
    set((state) => ({
      todos: state.todos.filter((todo) => todo.id !== id),
    })),

  reorderTodos: (todoIds) =>
    set((state) => {
      const todoMap = new Map(state.todos.map((t) => [t.id, t]));
      const reordered = todoIds
        .map((id) => todoMap.get(id))
        .filter((t): t is GlobalTodo => t !== undefined);
      // Add any todos not in todoIds at the end
      const remainingTodos = state.todos.filter((t) => !todoIds.includes(t.id));
      return { todos: [...reordered, ...remainingTodos] };
    }),

  setStats: (stats) => set({ stats }),

  setIsLoading: (isLoading) => set({ isLoading }),
}));
