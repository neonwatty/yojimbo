import { useState } from 'react';
import { useSessions, useDeleteSession } from '../hooks/use-sessions';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Session } from '@cc-orchestrator/shared';

// Icons
const Icons = {
  folder: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
      />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  trash: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  ),
  chevronRight: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  chevronDown: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(startedAt: string, endedAt?: string): string {
  const start = new Date(startedAt);
  const end = endedAt ? new Date(endedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffHours > 0) {
    return `${diffHours}h ${diffMins % 60}m`;
  }
  return `${diffMins}m`;
}

function getRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  return formatDate(dateString);
}

interface GroupedSessions {
  [date: string]: Session[];
}

function groupSessionsByDate(sessions: Session[]): GroupedSessions {
  return sessions.reduce((groups, session) => {
    const date = getRelativeDate(session.startedAt);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(session);
    return groups;
  }, {} as GroupedSessions);
}

export function HistoryPage() {
  const { data: sessions = [], isLoading, error } = useSessions();
  const deleteSession = useDeleteSession();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSession.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      if (expandedId === deleteTarget.id) {
        setExpandedId(null);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-theme-primary mb-6">Session History</h1>
        <div className="bg-surface-800 rounded-xl border border-state-error/30 p-8 text-center">
          <p className="text-state-error">Error loading sessions: {error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-theme-primary mb-6">Session History</h1>
        <div className="bg-surface-800 rounded-xl border border-surface-600 p-8 text-center">
          <p className="text-theme-muted">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-theme-primary mb-6">Session History</h1>
        <div className="bg-surface-800 rounded-xl border border-surface-600 p-8 text-center">
          <p className="text-theme-muted mb-2">No sessions yet</p>
          <p className="text-sm text-theme-muted">
            Sessions will appear here when you create and use instances.
          </p>
        </div>
      </div>
    );
  }

  const groupedSessions = groupSessionsByDate(sessions);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme-primary">Session History</h1>
        <span className="text-sm text-theme-muted">
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </span>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedSessions).map(([date, dateSessions]) => (
          <div key={date}>
            {/* Date header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-theme-muted">{date}</span>
              <div className="flex-1 h-px bg-surface-600" />
            </div>

            {/* Sessions list */}
            <div className="bg-surface-800 rounded-xl border border-surface-600 overflow-hidden">
              <div className="divide-y divide-surface-600">
                {dateSessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    isExpanded={expandedId === session.id}
                    onToggle={() => setExpandedId(expandedId === session.id ? null : session.id)}
                    onDelete={() => setDeleteTarget(session)}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Session"
        message={`Are you sure you want to delete the session "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function SessionRow({
  session,
  isExpanded,
  onToggle,
  onDelete,
}: {
  session: Session;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isActive = !session.endedAt;

  return (
    <div className="group">
      {/* Main row */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-surface-700 transition-colors"
        onClick={onToggle}
      >
        {/* Expand/collapse icon */}
        <span className="text-theme-muted">
          {isExpanded ? Icons.chevronDown : Icons.chevronRight}
        </span>

        {/* Session name and working dir */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-theme-primary truncate">{session.name}</span>
            {isActive && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-state-working/20 text-state-working border border-state-working/30">
                Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-theme-muted truncate">
            {Icons.folder}
            <span className="truncate">{session.workingDir}</span>
          </div>
        </div>

        {/* Time info */}
        <div className="flex items-center gap-4 text-sm text-theme-muted">
          <div className="flex items-center gap-1.5">
            {Icons.clock}
            <span>{formatTime(session.startedAt)}</span>
          </div>
          <span className="w-16 text-right">{formatDuration(session.startedAt, session.endedAt)}</span>
        </div>

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded text-theme-muted hover:text-state-error hover:bg-surface-600 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete session"
        >
          {Icons.trash}
        </button>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 ml-10 border-t border-surface-600 bg-surface-700/50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-theme-muted">Started:</span>
              <span className="ml-2 text-theme-primary">
                {formatDate(session.startedAt)} at {formatTime(session.startedAt)}
              </span>
            </div>
            {session.endedAt && (
              <div>
                <span className="text-theme-muted">Ended:</span>
                <span className="ml-2 text-theme-primary">
                  {formatDate(session.endedAt)} at {formatTime(session.endedAt)}
                </span>
              </div>
            )}
            <div>
              <span className="text-theme-muted">Messages:</span>
              <span className="ml-2 text-theme-primary">{session.messageCount}</span>
            </div>
            <div>
              <span className="text-theme-muted">Tokens:</span>
              <span className="ml-2 text-theme-primary">{session.tokenCount.toLocaleString()}</span>
            </div>
          </div>
          {session.summary && (
            <div className="mt-3 pt-3 border-t border-surface-600">
              <span className="text-sm text-theme-muted">Summary:</span>
              <p className="mt-1 text-sm text-theme-secondary">{session.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
