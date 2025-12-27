import { useEffect, useState } from 'react';
import { Icons } from '../common/Icons';
import { toast } from '../../store/toastStore';
import { MDXPlanEditor } from '../plans/MDXPlanEditor';
import type { SummaryType, GenerateSummaryResponse, CommandExecution } from '@cc-orchestrator/shared';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryType: SummaryType;
  summaryData: GenerateSummaryResponse | null;
  isLoading: boolean;
  // Streaming props
  streamingCommands?: CommandExecution[];
  isStreaming?: boolean;
}

function CommandStatusIcon({ status }: { status: CommandExecution['status'] }) {
  switch (status) {
    case 'running':
      return (
        <div className="animate-spin rounded-full h-3 w-3 border border-accent border-t-transparent" />
      );
    case 'success':
      return (
        <span className="text-green-400">
          <Icons.check />
        </span>
      );
    case 'error':
      return (
        <span className="text-red-400">
          <Icons.close />
        </span>
      );
    default:
      return <div className="w-3 h-3 rounded-full bg-surface-500" />;
  }
}

export function SummaryModal({
  isOpen,
  onClose,
  summaryType,
  summaryData,
  isLoading,
  streamingCommands = [],
  isStreaming = false,
}: SummaryModalProps) {
  const [copied, setCopied] = useState(false);
  const [showCommands, setShowCommands] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setShowCommands(false);
    }
  }, [isOpen]);

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

  const handleCopy = async () => {
    if (!summaryData?.summary) return;

    try {
      await navigator.clipboard.writeText(summaryData.summary);
      setCopied(true);
      toast.success('Summary copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (!isOpen) return null;

  const title = summaryType === 'daily' ? 'Daily Summary' : 'Weekly Summary';
  const hasStreamingCommands = streamingCommands.length > 0;
  const isStillRunning = isLoading || isStreaming;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-700 rounded-xl shadow-2xl max-w-3xl w-full mx-4 animate-in max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <div className="flex items-center gap-2">
            <Icons.document />
            <h2 className="text-lg font-semibold text-theme-primary">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            <Icons.close />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Live Commands Section - shown during streaming */}
          {hasStreamingCommands && (
            <div className="mb-4">
              {isStillRunning ? (
                // Always visible during streaming
                <div className="border border-surface-600 rounded-lg overflow-hidden">
                  <div className="px-4 py-2 flex items-center gap-2 bg-surface-800 text-sm text-theme-primary border-b border-surface-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent" />
                    <span>Running commands...</span>
                  </div>
                  <div className="p-4 bg-surface-900 font-mono text-xs space-y-3 max-h-48 overflow-y-auto">
                    {streamingCommands.map((cmd, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          <CommandStatusIcon status={cmd.status} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <code className={`break-all ${
                            cmd.status === 'running' ? 'text-accent' :
                            cmd.status === 'success' ? 'text-theme-muted' :
                            cmd.status === 'error' ? 'text-red-400' :
                            'text-theme-dim'
                          }`}>
                            $ {cmd.command}
                          </code>
                          {cmd.status === 'success' && cmd.resultCount !== undefined && (
                            <span className="ml-2 text-green-400/70">
                              ({cmd.resultCount} {cmd.resultCount === 1 ? 'result' : 'results'})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                // Collapsible after streaming is done
                <div className="border border-surface-600 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowCommands(!showCommands)}
                    className="w-full px-4 py-2 flex items-center justify-between bg-surface-800 text-sm text-theme-primary hover:bg-surface-700 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Icons.terminal />
                      Commands Executed ({streamingCommands.length})
                      <span className="text-green-400 text-xs">✓ Complete</span>
                    </span>
                    {showCommands ? <Icons.chevronUp /> : <Icons.chevronDown />}
                  </button>
                  {showCommands && (
                    <div className="p-4 bg-surface-900 font-mono text-xs space-y-2 max-h-48 overflow-y-auto">
                      {streamingCommands.map((cmd, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="shrink-0 mt-0.5">
                            <CommandStatusIcon status={cmd.status} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <code className="text-theme-muted break-all">$ {cmd.command}</code>
                            {cmd.status === 'success' && cmd.resultCount !== undefined && (
                              <span className="ml-2 text-green-400/70">
                                ({cmd.resultCount} {cmd.resultCount === 1 ? 'result' : 'results'})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Loading state - show when loading but no streaming commands yet */}
          {isLoading && !hasStreamingCommands && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
              <p className="text-theme-muted">Generating summary with Claude...</p>
              <p className="text-xs text-theme-muted">This may take a moment</p>
            </div>
          )}

          {/* Summary content - show after generation */}
          {summaryData?.summary && !isStillRunning && (
            <div className="space-y-4">
              {/* Rendered Markdown Summary */}
              <div className="bg-surface-800 rounded-lg border border-surface-600 overflow-hidden">
                <MDXPlanEditor markdown={summaryData.summary} readOnly />
              </div>

              {/* Raw Data Stats */}
              {summaryData.rawData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-surface-800 rounded-lg p-3 text-center border border-surface-600">
                    <div className="text-lg font-bold text-accent">
                      {summaryData.rawData.prsCreated.length}
                    </div>
                    <div className="text-xs text-theme-muted">PRs Created</div>
                  </div>
                  <div className="bg-surface-800 rounded-lg p-3 text-center border border-surface-600">
                    <div className="text-lg font-bold text-green-400">
                      {summaryData.rawData.prsMerged.length}
                    </div>
                    <div className="text-xs text-theme-muted">PRs Merged</div>
                  </div>
                  <div className="bg-surface-800 rounded-lg p-3 text-center border border-surface-600">
                    <div className="text-lg font-bold text-blue-400">
                      {summaryData.rawData.commits.length}
                    </div>
                    <div className="text-xs text-theme-muted">Commits</div>
                  </div>
                  <div className="bg-surface-800 rounded-lg p-3 text-center border border-surface-600">
                    <div className="text-lg font-bold text-purple-400">
                      {summaryData.rawData.issuesClosed.length}
                    </div>
                    <div className="text-xs text-theme-muted">Issues Closed</div>
                  </div>
                </div>
              )}

              {/* Fallback: Show commandsExecuted from response if no streaming commands */}
              {!hasStreamingCommands && summaryData.commandsExecuted && summaryData.commandsExecuted.length > 0 && (
                <div className="border border-surface-600 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowCommands(!showCommands)}
                    className="w-full px-4 py-2 flex items-center justify-between bg-surface-800 text-sm text-theme-primary hover:bg-surface-700 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Icons.terminal />
                      Commands Executed ({summaryData.commandsExecuted.length})
                    </span>
                    {showCommands ? <Icons.chevronUp /> : <Icons.chevronDown />}
                  </button>
                  {showCommands && (
                    <div className="p-4 bg-surface-900 font-mono text-xs space-y-2 max-h-48 overflow-y-auto">
                      {summaryData.commandsExecuted.map((cmd, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-accent shrink-0">$</span>
                          <code className="text-theme-muted break-all">{cmd}</code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !summaryData?.summary && !hasStreamingCommands && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-theme-muted">No summary available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-600 flex items-center justify-between">
          <span className="text-xs text-theme-muted">
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-surface-800 border border-surface-500 rounded text-xs font-mono">
              Esc
            </kbd>{' '}
            to close
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-theme-muted hover:text-theme-primary transition-colors"
            >
              Close
            </button>
            {summaryData?.summary && !isStillRunning && (
              <button
                onClick={handleCopy}
                disabled={copied}
                className="flex items-center gap-2 px-4 py-1.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {copied ? (
                  <>
                    <Icons.check />
                    Copied
                  </>
                ) : (
                  <>
                    <Icons.copy />
                    Copy to Clipboard
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
