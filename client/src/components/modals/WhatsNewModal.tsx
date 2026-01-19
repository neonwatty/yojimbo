import { useEffect, useState, useCallback } from 'react';
import { releasesApi } from '../../api/client';
import { Icons } from '../common/Icons';
import { MDXPlanEditor } from '../plans/MDXPlanEditor';
import type { Release } from '@cc-orchestrator/shared';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhatsNewModal({ isOpen, onClose }: WhatsNewModalProps) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReleases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await releasesApi.list();
      if (response.success && response.data) {
        setReleases(response.data);
        // Auto-select the latest release
        if (response.data.length > 0) {
          setSelectedRelease(response.data[0]);
        }
      } else {
        setError(response.error || 'Failed to load releases');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchReleases();
    }
  }, [isOpen, fetchReleases]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedRelease(null);
      setReleases([]);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-surface-700 shadow-2xl w-full mx-0 sm:mx-4 sm:my-auto sm:max-w-4xl sm:rounded-xl max-sm:min-h-full max-sm:rounded-none flex flex-col max-h-full sm:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-600">
          <div className="flex items-center gap-2">
            <span className="text-lg">📢</span>
            <h2 className="text-base sm:text-lg font-semibold text-theme-primary">What's New</h2>
          </div>
          <div className="flex items-center gap-3">
            {selectedRelease && (
              <span className="text-sm text-theme-muted">{selectedRelease.version}</span>
            )}
            <button
              onClick={onClose}
              className="p-2 sm:p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
            >
              <Icons.close />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-theme-muted text-sm">Loading releases...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center px-4">
                <p className="text-red-400 mb-3">{error}</p>
                <button
                  onClick={fetchReleases}
                  className="px-4 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent/90 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : releases.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-theme-muted">No releases found</p>
            </div>
          ) : (
            <>
              {/* Version list (left pane) */}
              <div className="w-32 sm:w-40 flex-shrink-0 border-r border-surface-600 overflow-y-auto">
                {releases.map((release) => (
                  <button
                    key={release.version}
                    onClick={() => setSelectedRelease(release)}
                    className={`w-full px-3 py-2.5 text-left border-b border-surface-600 last:border-b-0 transition-colors ${
                      selectedRelease?.version === release.version
                        ? 'bg-accent/20 text-accent'
                        : 'hover:bg-surface-600 text-theme-primary'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{release.version}</span>
                      {release.isPrerelease && (
                        <span className="px-1 py-0.5 text-[9px] bg-yellow-500/20 text-yellow-400 rounded shrink-0">
                          pre
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-theme-muted">{formatShortDate(release.publishedAt)}</span>
                  </button>
                ))}
              </div>

              {/* Release details (right pane) */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {selectedRelease ? (
                  <>
                    {/* Release header */}
                    <div className="px-4 sm:px-6 py-3 border-b border-surface-600">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-theme-primary">
                            {selectedRelease.name}
                          </h3>
                          <p className="text-sm text-theme-muted mt-0.5">
                            Released {formatDate(selectedRelease.publishedAt)}
                          </p>
                        </div>
                        <a
                          href={selectedRelease.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 px-3 py-1.5 text-xs bg-surface-600 text-theme-primary rounded-lg hover:bg-surface-500 transition-colors flex items-center gap-1.5"
                        >
                          <Icons.link />
                          View on GitHub
                        </a>
                      </div>
                    </div>

                    {/* Release body */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                      {selectedRelease.body ? (
                        <div className="mdx-editor-wrapper dark-theme prose-sm">
                          <MDXPlanEditor
                            markdown={selectedRelease.body}
                            readOnly={true}
                          />
                        </div>
                      ) : (
                        <p className="text-theme-muted italic">No release notes available.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-theme-muted">Select a release to view details</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-surface-600 flex items-center justify-between" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <span className="text-xs text-theme-muted hidden sm:inline">
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-surface-800 border border-surface-500 rounded text-xs font-mono">
              Esc
            </kbd>{' '}
            to close
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-surface-600 text-theme-primary rounded-lg text-sm font-medium hover:bg-surface-500 transition-colors ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
