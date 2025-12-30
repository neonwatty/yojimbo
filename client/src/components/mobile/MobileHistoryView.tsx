import { useState, useEffect, useCallback, useRef } from 'react';
import { sessionsApi } from '../../api/client';
import { Icons } from '../common/Icons';
import type { Session, SessionMessage } from '@cc-orchestrator/shared';

interface MobileHistoryViewProps {
  onTopGesture: () => void;
  onBottomGesture: () => void;
}

export function MobileHistoryView({ onTopGesture, onBottomGesture }: MobileHistoryViewProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [sessionMessages, setSessionMessages] = useState<Record<string, SessionMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

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

  const fetchSessions = useCallback(async (pageNum: number, query?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      if (query) {
        const response = await sessionsApi.search(query);
        if (response.data) {
          setSessions(response.data);
          setHasMore(false);
        }
      } else {
        const response = await sessionsApi.list(pageNum, 20);
        if (response.data) {
          if (pageNum === 1) {
            setSessions(response.data.items);
          } else {
            setSessions((prev) => [...prev, ...response.data!.items]);
          }
          setHasMore(response.data.hasMore);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(1);
  }, [fetchSessions]);

  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchQuery) {
        fetchSessions(1, searchQuery);
      } else {
        fetchSessions(1);
      }
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, fetchSessions]);

  const loadMoreSessions = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSessions(nextPage, searchQuery || undefined);
    }
  };

  const loadMessages = async (sessionId: string) => {
    if (sessionMessages[sessionId] || loadingMessages.has(sessionId)) {
      return;
    }

    setLoadingMessages((prev) => new Set(prev).add(sessionId));

    try {
      const response = await sessionsApi.getMessages(sessionId, 1, 50);
      if (response.data) {
        setSessionMessages((prev) => ({
          ...prev,
          [sessionId]: response.data!.items,
        }));
      }
    } catch {
      // Error toast shown by API layer
    } finally {
      setLoadingMessages((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatTokens = (count: number) => (count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count);

  const toggleSession = (id: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        loadMessages(id);
      }
      return next;
    });
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'user':
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      case 'assistant':
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        );
      case 'tool':
        return (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        );
      default:
        return null;
    }
  };

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
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-theme-primary">History</h1>
          <p className="text-xs text-theme-dim mt-0.5">Past Claude Code sessions</p>
        </div>

        {/* Search Input */}
        <div className="relative mb-4">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-700 border border-surface-600 rounded-xl px-4 py-3 pl-10 text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-red-400 text-sm">
            {error}
            <button
              onClick={() => fetchSessions(1)}
              className="ml-2 underline active:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && sessions.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-700 rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-surface-600 rounded w-2/3 mb-2" />
                <div className="h-3 bg-surface-600 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Sessions List */}
        {(!isLoading || sessions.length > 0) && (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="bg-surface-700 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between p-4 text-left active:bg-surface-600/50 transition-colors"
                  onClick={() => toggleSession(session.id)}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-theme-primary truncate text-sm">
                        {session.summary || 'Untitled Session'}
                      </span>
                    </div>
                    <div className="text-[10px] text-theme-muted font-mono truncate mb-1">
                      {session.projectPath?.split('/').pop() || session.projectPath}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-theme-dim">
                      <span>{formatTime(session.startedAt)}</span>
                      <span>•</span>
                      <span>{session.messageCount} msgs</span>
                      <span>•</span>
                      <span>{formatTokens(session.tokenCount)} tokens</span>
                    </div>
                  </div>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`text-theme-muted transition-transform duration-200 flex-shrink-0 ${
                      expandedSessions.has(session.id) ? 'rotate-180' : ''
                    }`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {expandedSessions.has(session.id) && (
                  <div className="border-t border-surface-600 p-3 bg-surface-800/50 max-h-48 overflow-auto">
                    {loadingMessages.has(session.id) ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : sessionMessages[session.id]?.length ? (
                      <div className="space-y-1.5">
                        {sessionMessages[session.id].slice(0, 15).map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex items-start gap-2 text-xs ${
                              msg.messageType === 'user'
                                ? 'text-blue-400'
                                : msg.messageType === 'assistant'
                                ? 'text-green-400'
                                : 'text-yellow-400'
                            }`}
                          >
                            <span className="flex-shrink-0 mt-0.5 opacity-70">
                              {getMessageIcon(msg.messageType)}
                            </span>
                            <span className="truncate">
                              {msg.preview || msg.toolName || `[${msg.messageType}]`}
                            </span>
                          </div>
                        ))}
                        {sessionMessages[session.id].length > 15 && (
                          <p className="text-[10px] text-theme-dim text-center pt-1">
                            +{sessionMessages[session.id].length - 15} more messages
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-theme-muted text-center py-4">No messages found</p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Load more button */}
            {hasMore && (
              <button
                onClick={loadMoreSessions}
                disabled={isLoading}
                className="w-full py-3 text-center text-sm text-theme-muted active:text-theme-primary bg-surface-700 rounded-xl active:bg-surface-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load more sessions'}
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && sessions.length === 0 && !error && (
          <div className="text-center py-12 text-theme-muted">
            <div className="mb-3 opacity-50">
              <Icons.history />
            </div>
            <p className="text-sm">
              {searchQuery ? `No sessions found for "${searchQuery}"` : 'No session history yet'}
            </p>
            <p className="text-xs mt-2 opacity-70">
              Sessions from Claude Code will appear here automatically
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

export default MobileHistoryView;
