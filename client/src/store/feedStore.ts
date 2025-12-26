import { create } from 'zustand';
import type { ActivityEvent, ActivityFeedStats } from '@cc-orchestrator/shared';

interface FeedState {
  events: ActivityEvent[];
  stats: ActivityFeedStats;
  isLoading: boolean;

  setEvents: (events: ActivityEvent[]) => void;
  addEvent: (event: ActivityEvent) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setStats: (stats: ActivityFeedStats) => void;
  setIsLoading: (isLoading: boolean) => void;
  clearEvents: () => void;
}

export const useFeedStore = create<FeedState>()((set) => ({
  events: [],
  stats: { total: 0, unread: 0 },
  isLoading: false,

  setEvents: (events) => set({ events }),

  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events],
      stats: {
        ...state.stats,
        total: state.stats.total + 1,
        unread: state.stats.unread + 1,
      },
    })),

  markAsRead: (id) =>
    set((state) => ({
      events: state.events.map((event) =>
        event.id === id && !event.readAt
          ? { ...event, readAt: new Date().toISOString() }
          : event
      ),
      stats: {
        ...state.stats,
        unread: Math.max(0, state.stats.unread - 1),
      },
    })),

  markAllAsRead: () =>
    set((state) => ({
      events: state.events.map((event) =>
        event.readAt ? event : { ...event, readAt: new Date().toISOString() }
      ),
      stats: {
        ...state.stats,
        unread: 0,
      },
    })),

  setStats: (stats) => set({ stats }),

  setIsLoading: (isLoading) => set({ isLoading }),

  clearEvents: () => set({ events: [], stats: { total: 0, unread: 0 } }),
}));
