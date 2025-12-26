import { useState, useEffect, useCallback } from 'react';
import { feedApi } from '../api/client';
import { useFeedStore } from '../store/feedStore';
import { useSettingsStore } from '../store/settingsStore';
import { formatDistanceToNow } from '../utils/time';
import { Icons } from '../components/common/Icons';
import type { ActivityEvent, ActivityEventType } from '@cc-orchestrator/shared';

type FilterType = 'all' | ActivityEventType;

export default function ActivityPage() {
  const { events, setEvents, stats, setStats, isLoading, setIsLoading, markAsRead, markAllAsRead } = useFeedStore();
  const { feedEnabledEventTypes } = useSettingsStore();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await feedApi.list(100);
      if (response.data) {
        setEvents(response.data);
      }
      const statsResponse = await feedApi.getStats();
      if (statsResponse.data) {
        setStats(statsResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setIsLoading(false);
    }
  }, [setEvents, setStats, setIsLoading]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleMarkAsRead = async (event: ActivityEvent) => {
    if (event.readAt) return;

    try {
      await feedApi.markAsRead(event.id);
      markAsRead(event.id);
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await feedApi.markAllAsRead();
      markAllAsRead();
    } catch {
      // Error toast shown by API layer
    }
  };

  const getEventIcon = (eventType: ActivityEventType) => {
    switch (eventType) {
      case 'completed':
        return <Icons.check className="w-4 h-4 text-green-400" />;
      case 'awaiting':
        return <Icons.notification className="w-4 h-4 text-yellow-400" />;
      case 'error':
        return <Icons.alert className="w-4 h-4 text-red-400" />;
      case 'started':
        return <Icons.play className="w-4 h-4 text-blue-400" />;
      default:
        return <Icons.activity className="w-4 h-4 text-theme-muted" />;
    }
  };

  const getEventTypeLabel = (eventType: ActivityEventType) => {
    switch (eventType) {
      case 'completed':
        return 'Completed';
      case 'awaiting':
        return 'Awaiting';
      case 'error':
        return 'Error';
      case 'started':
        return 'Started';
      default:
        return eventType;
    }
  };

  // Filter events based on settings and current filter
  const filteredEvents = events.filter((event) => {
    // First check if this event type is enabled in settings
    if (!feedEnabledEventTypes.includes(event.eventType)) {
      return false;
    }
    // Then apply the page filter
    if (filter === 'all') return true;
    return event.eventType === filter;
  });

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'completed', label: 'Completed' },
    { value: 'awaiting', label: 'Awaiting' },
    { value: 'error', label: 'Error' },
    { value: 'started', label: 'Started' },
  ];

  return (
    <div className="flex-1 overflow-auto bg-surface-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-theme-primary">Activity</h2>
            {stats.unread > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-accent/20 text-accent rounded-full">
                {stats.unread} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Filter dropdown */}
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            {/* Mark all read button */}
            {stats.unread > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="px-3 py-2 text-sm text-theme-muted hover:text-theme-primary bg-surface-700 rounded-lg hover:bg-surface-600 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-400 text-sm">
            {error}
            <button onClick={fetchEvents} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && events.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-700 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-surface-600 rounded w-1/3 mb-2" />
                <div className="h-3 bg-surface-600 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Events List */}
        {!isLoading || events.length > 0 ? (
          <div className="space-y-2">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                className={`flex items-start gap-3 p-4 bg-surface-700 rounded-xl cursor-pointer hover:bg-surface-600/50 transition-colors ${
                  !event.readAt ? 'border-l-2 border-accent' : ''
                }`}
                onClick={() => handleMarkAsRead(event)}
              >
                {/* Unread indicator */}
                <div className="flex-shrink-0 mt-1">
                  {!event.readAt && (
                    <div className="w-2 h-2 bg-accent rounded-full" />
                  )}
                  {event.readAt && <div className="w-2 h-2" />}
                </div>

                {/* Event icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getEventIcon(event.eventType)}
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-theme-primary">
                      {event.instanceName}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      event.eventType === 'completed' ? 'bg-green-500/20 text-green-400' :
                      event.eventType === 'awaiting' ? 'bg-yellow-500/20 text-yellow-400' :
                      event.eventType === 'error' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {getEventTypeLabel(event.eventType)}
                    </span>
                  </div>
                  <p className="text-sm text-theme-muted">{event.message}</p>
                </div>

                {/* Timestamp */}
                <div className="flex-shrink-0 text-xs text-theme-dim">
                  {formatDistanceToNow(event.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Empty state */}
        {!isLoading && filteredEvents.length === 0 && !error && (
          <div className="text-center py-12 text-theme-muted">
            <Icons.activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {filter !== 'all'
                ? `No ${filter} events`
                : 'No activity yet'}
            </p>
            <p className="text-xs mt-2 opacity-70">
              Activity from your Claude Code instances will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
