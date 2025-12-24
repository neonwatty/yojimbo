import { useState, useEffect, useCallback } from 'react';
import { sessionsApi } from '../api/client';
import type { Session, SessionMessage } from '@cc-orchestrator/shared';

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [sessionMessages, setSessionMessages] = useState<Record<string, SessionMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

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
      const response = await sessionsApi.getMessages(sessionId, 1, 100);
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
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      case 'assistant':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        );
      case 'tool':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-surface-800 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-theme-primary">Session History</h2>
          <div className="relative">
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
              className="w-64 bg-surface-700 border border-surface-600 rounded-lg px-4 py-2 pl-10 text-sm text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4 text-red-400 text-sm">
            {error}
            <button
              onClick={() => fetchSessions(1)}
              className="ml-2 underline hover:no-underline"
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
                <div className="h-4 bg-surface-600 rounded w-1/3 mb-2" />
                <div className="h-3 bg-surface-600 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Sessions List */}
        {!isLoading || sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="bg-surface-700 rounded-xl overflow-hidden hover-lift">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-surface-600/50 transition-colors"
                  onClick={() => toggleSession(session.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-theme-primary truncate">
                        {session.summary || 'Untitled Session'}
                      </span>
                      <span className="text-xs text-theme-muted">{formatTime(session.startedAt)}</span>
                    </div>
                    <div className="text-xs text-theme-muted font-mono truncate">{session.projectPath}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-theme-muted">
                      <span>{session.messageCount} messages</span>
                      <span className="text-theme-dim">•</span>
                      <span>{formatTokens(session.tokenCount)} tokens</span>
                    </div>
                  </div>
                  <svg
                    width="20"
                    height="20"
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
                </div>

                {expandedSessions.has(session.id) && (
                  <div className="border-t border-surface-600 p-4 bg-surface-800/50 max-h-80 overflow-auto">
                    {loadingMessages.has(session.id) ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : sessionMessages[session.id]?.length ? (
                      <div className="space-y-2">
                        {sessionMessages[session.id].map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex items-start gap-2 text-sm ${
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
                      </div>
                    ) : (
                      <p className="text-sm text-theme-muted text-center py-4">No messages found</p>
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
                className="w-full py-3 text-center text-sm text-theme-muted hover:text-theme-primary bg-surface-700 rounded-xl hover:bg-surface-600 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load more sessions'}
              </button>
            )}
          </div>
        ) : null}

        {/* Empty state */}
        {!isLoading && sessions.length === 0 && !error && (
          <div className="text-center py-12 text-theme-muted">
            <svg
              className="w-12 h-12 mx-auto mb-3 opacity-50"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">
              {searchQuery ? `No sessions found for "${searchQuery}"` : 'No session history yet'}
            </p>
            <p className="text-xs mt-2 opacity-70">
              Sessions from Claude Code will appear here automatically
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
