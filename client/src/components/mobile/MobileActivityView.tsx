import { useState, useEffect, useCallback, useRef } from 'react';
import { feedApi } from '../../api/client';
import { useFeedStore } from '../../store/feedStore';
import { useSettingsStore } from '../../store/settingsStore';
import { formatDistanceToNow } from '../../utils/time';
import { Icons } from '../common/Icons';
import type { ActivityEvent, ActivityEventType } from '@cc-orchestrator/shared';

type FilterType = 'all' | ActivityEventType;

interface MobileActivityViewProps {
  onTopGesture: () => void;
  onBottomGesture: () => void;
}

export function MobileActivityView({ onTopGesture, onBottomGesture }: MobileActivityViewProps) {
  const { events, setEvents, stats, setStats, isLoading, setIsLoading, markAsRead, markAllAsRead } = useFeedStore();
  const { feedEnabledEventTypes } = useSettingsStore();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  const touchRef = useRef({ startY: 0, zone: null as string | null });

  // Gesture handling for edge swipes
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = touch.clientY - rect.top;
    const height = rect.height;

    let zone: string | null = null;
    if (relativeY < 80) zone = 'top';
    else if (relativeY > height - 80) zone = 'bottom';

    touchRef.current = { startY: touch.clientY, zone };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const { startY, zone } = touchRef.current;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaY) > 50) {
      if (zone === 'top' && deltaY > 0 && onTopGesture) {
        onTopGesture();
      } else if (zone === 'bottom' && deltaY < 0 && onBottomGesture) {
        onBottomGesture();
      }
    }
  }, [onTopGesture, onBottomGesture]);

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
    if (!feedEnabledEventTypes.includes(event.eventType)) {
      return false;
    }
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
    <div
      className="flex-1 flex flex-col bg-surface-800 overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Visual hint indicator */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>

      <div className="flex-1 px-4 pb-4 overflow-auto mobile-scroll">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-theme-primary">Activity</h1>
            {stats.unread > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-accent/20 text-accent rounded-full">
                {stats.unread} new
              </span>
            )}
          </div>
          {stats.unread > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="px-3 py-1.5 text-xs text-theme-muted active:text-theme-primary bg-surface-700 rounded-lg active:bg-surface-600 transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1 mobile-scroll">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                filter === option.value
                  ? 'bg-accent text-surface-900'
                  : 'bg-surface-700 text-theme-muted active:bg-surface-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-red-400 text-sm">
            {error}
            <button
              onClick={fetchEvents}
              className="ml-2 underline active:no-underline"
            >
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
        {(!isLoading || events.length > 0) && (
          <div className="space-y-2">
            {filteredEvents.map((event) => (
              <button
                key={event.id}
                className={`w-full flex items-start gap-3 p-3 bg-surface-700 rounded-xl text-left active:bg-surface-600/50 transition-colors ${
                  !event.readAt ? 'border-l-2 border-accent' : ''
                }`}
                onClick={() => handleMarkAsRead(event)}
              >
                {/* Event icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getEventIcon(event.eventType)}
                </div>

                {/* Event content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-sm text-theme-primary truncate">
                      {event.instanceName}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      event.eventType === 'completed' ? 'bg-green-500/20 text-green-400' :
                      event.eventType === 'awaiting' ? 'bg-yellow-500/20 text-yellow-400' :
                      event.eventType === 'error' ? 'bg-red-500/20 text-red-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {getEventTypeLabel(event.eventType)}
                    </span>
                    {!event.readAt && (
                      <div className="w-1.5 h-1.5 bg-accent rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-theme-muted line-clamp-2">{event.message}</p>
                  <p className="text-[10px] text-theme-dim mt-1">
                    {formatDistanceToNow(event.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredEvents.length === 0 && !error && (
          <div className="text-center py-12 text-theme-muted">
            <div className="mb-3 opacity-50">
              <Icons.activity />
            </div>
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

      {/* Bottom gesture hint */}
      <div className="flex justify-center pb-2">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>
    </div>
  );
}

export default MobileActivityView;
