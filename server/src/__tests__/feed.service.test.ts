import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const { mockRun, mockGet, mockAll } = vi.hoisted(() => ({
  mockRun: vi.fn(),
  mockGet: vi.fn(),
  mockAll: vi.fn(),
}));

vi.mock('../db/connection.js', () => ({
  getDatabase: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      run: mockRun,
      get: mockGet,
      all: mockAll,
    }),
  })),
}));

vi.mock('../websocket/server.js', () => ({
  broadcast: vi.fn(),
}));

vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-1234'),
}));

// Import after mocks
import {
  createActivityEvent,
  listActivityEvents,
  getActivityFeedStats,
  markEventAsRead,
  markAllEventsAsRead,
  clearAllEvents,
} from '../services/feed.service.js';
import { broadcast } from '../websocket/server.js';

describe('FeedService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createActivityEvent', () => {
    it('should create an activity event and broadcast it', () => {
      mockRun.mockReturnValue({ changes: 1 });

      const event = createActivityEvent(
        'instance-1',
        'Test Instance',
        'started',
        'Test Instance started working'
      );

      expect(event.id).toBe('test-uuid-1234');
      expect(event.instanceId).toBe('instance-1');
      expect(event.instanceName).toBe('Test Instance');
      expect(event.eventType).toBe('started');
      expect(event.message).toBe('Test Instance started working');
      expect(event.readAt).toBeNull();

      expect(broadcast).toHaveBeenCalledWith({
        type: 'feed:new',
        event: expect.objectContaining({
          id: 'test-uuid-1234',
          eventType: 'started',
        }),
      });
    });

    it('should create an activity event with metadata', () => {
      mockRun.mockReturnValue({ changes: 1 });

      const metadata = { exitCode: 0, duration: 5000 };
      const event = createActivityEvent(
        'instance-1',
        'Test Instance',
        'completed',
        'Test Instance completed',
        metadata
      );

      expect(event.metadata).toEqual(metadata);
    });

    it('should create an activity event without metadata', () => {
      mockRun.mockReturnValue({ changes: 1 });

      const event = createActivityEvent(
        'instance-1',
        'Test Instance',
        'error',
        'Test Instance encountered an error'
      );

      expect(event.metadata).toBeNull();
    });
  });

  describe('listActivityEvents', () => {
    it('should return a list of activity events', () => {
      mockAll.mockReturnValue([
        {
          id: 'event-1',
          instance_id: 'instance-1',
          instance_name: 'Test Instance',
          event_type: 'started',
          message: 'Started working',
          metadata: null,
          created_at: '2024-01-01T00:00:00.000Z',
          read_at: null,
        },
        {
          id: 'event-2',
          instance_id: 'instance-2',
          instance_name: 'Another Instance',
          event_type: 'completed',
          message: 'Completed',
          metadata: '{"exitCode":0}',
          created_at: '2024-01-01T00:01:00.000Z',
          read_at: '2024-01-01T00:02:00.000Z',
        },
      ]);

      const events = listActivityEvents(50, 0);

      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('event-1');
      expect(events[0].instanceId).toBe('instance-1');
      expect(events[0].eventType).toBe('started');
      expect(events[0].readAt).toBeNull();

      expect(events[1].id).toBe('event-2');
      expect(events[1].metadata).toEqual({ exitCode: 0 });
      expect(events[1].readAt).toBe('2024-01-01T00:02:00.000Z');
    });

    it('should return empty array when no events', () => {
      mockAll.mockReturnValue([]);

      const events = listActivityEvents();

      expect(events).toEqual([]);
    });

    it('should use default limit and offset', () => {
      mockAll.mockReturnValue([]);

      listActivityEvents();

      // The prepare().all() is called with limit and offset
      expect(mockAll).toHaveBeenCalledWith(50, 0);
    });

    it('should use custom limit and offset', () => {
      mockAll.mockReturnValue([]);

      listActivityEvents(10, 20);

      expect(mockAll).toHaveBeenCalledWith(10, 20);
    });
  });

  describe('getActivityFeedStats', () => {
    it('should return feed statistics', () => {
      mockGet.mockReturnValueOnce({ count: 100 }).mockReturnValueOnce({ count: 25 });

      const stats = getActivityFeedStats();

      expect(stats.total).toBe(100);
      expect(stats.unread).toBe(25);
    });

    it('should return zero counts when empty', () => {
      mockGet.mockReturnValueOnce({ count: 0 }).mockReturnValueOnce({ count: 0 });

      const stats = getActivityFeedStats();

      expect(stats.total).toBe(0);
      expect(stats.unread).toBe(0);
    });
  });

  describe('markEventAsRead', () => {
    it('should mark an event as read and broadcast update', () => {
      mockRun.mockReturnValue({ changes: 1 });
      mockGet.mockReturnValue({
        id: 'event-1',
        instance_id: 'instance-1',
        instance_name: 'Test Instance',
        event_type: 'started',
        message: 'Started',
        metadata: null,
        created_at: '2024-01-01T00:00:00.000Z',
        read_at: '2024-01-01T00:05:00.000Z',
      });

      const event = markEventAsRead('event-1');

      expect(event).not.toBeNull();
      expect(event?.id).toBe('event-1');
      expect(event?.readAt).toBe('2024-01-01T00:05:00.000Z');
      expect(broadcast).toHaveBeenCalledWith({ type: 'feed:updated' });
    });

    it('should return null when event not found', () => {
      mockRun.mockReturnValue({ changes: 0 });
      mockGet.mockReturnValue(undefined);

      const event = markEventAsRead('non-existent');

      expect(event).toBeNull();
    });
  });

  describe('markAllEventsAsRead', () => {
    it('should mark all events as read and broadcast update', () => {
      mockRun.mockReturnValue({ changes: 10 });

      const count = markAllEventsAsRead();

      expect(count).toBe(10);
      expect(broadcast).toHaveBeenCalledWith({ type: 'feed:updated' });
    });

    it('should not broadcast when no events to mark', () => {
      mockRun.mockReturnValue({ changes: 0 });

      const count = markAllEventsAsRead();

      expect(count).toBe(0);
      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  describe('clearAllEvents', () => {
    it('should clear all events and broadcast update', () => {
      mockRun.mockReturnValue({ changes: 50 });

      const count = clearAllEvents();

      expect(count).toBe(50);
      expect(broadcast).toHaveBeenCalledWith({ type: 'feed:updated' });
    });

    it('should not broadcast when no events to clear', () => {
      mockRun.mockReturnValue({ changes: 0 });

      const count = clearAllEvents();

      expect(count).toBe(0);
      expect(broadcast).not.toHaveBeenCalled();
    });
  });
});
