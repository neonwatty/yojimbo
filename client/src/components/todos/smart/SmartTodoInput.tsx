import { useState, useRef, useEffect } from 'react';
import { Icons } from '../../common/Icons';
import { useSmartTodosStore } from '../../../store/smartTodosStore';
import { smartTodosApi, projectsApi } from '../../../api/client';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { getWsUrl } from '../../../config';

interface ProgressStep {
  step: string;
  message: string;
  toolName?: string;
  timestamp: number;
}

interface SmartTodoInputProps {
  onCancel: () => void;
  onParsed: () => void;
}

export function SmartTodoInput({ onCancel, onParsed }: SmartTodoInputProps) {
  const {
    isAvailable,
    availabilityMessage,
    state,
    rawInput,
    setRawInput,
    startParsing,
    setParsedResult,
    setError,
    setAvailability,
    setProjects,
  } = useSmartTodosStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);
  const [progressLog, setProgressLog] = useState<ProgressStep[]>([]);

  // WebSocket for progress updates
  const { subscribe, isConnected } = useWebSocket(getWsUrl());

  // Subscribe to smart task progress events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('smart-todo:progress', (data: unknown) => {
      const { smartTodoProgress } = data as {
        smartTodoProgress?: {
          step: string;
          message: string;
          toolName?: string;
        };
      };
      if (smartTodoProgress) {
        setProgressLog((prev) => [
          ...prev,
          {
            step: smartTodoProgress.step,
            message: smartTodoProgress.message,
            toolName: smartTodoProgress.toolName,
            timestamp: Date.now(),
          },
        ]);
      }
    });

    return unsubscribe;
  }, [isConnected, subscribe]);

  // Check availability and fetch projects on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [statusRes, projectsRes] = await Promise.all([
          smartTodosApi.status(),
          projectsApi.list(),
        ]);

        if (statusRes.data) {
          setAvailability(statusRes.data.available, statusRes.data.message);
        }
        if (projectsRes.data) {
          setProjects(projectsRes.data);
        }
      } catch (err) {
        setAvailability(false, 'Failed to check Smart Tasks availability');
      } finally {
        setHasCheckedStatus(true);
      }
    };

    checkStatus();
  }, [setAvailability, setProjects]);

  // Focus textarea when available
  useEffect(() => {
    if (hasCheckedStatus && isAvailable) {
      textareaRef.current?.focus();
    }
  }, [hasCheckedStatus, isAvailable]);

  const handleParse = async () => {
    if (!rawInput.trim() || state === 'parsing') return;

    // Clear progress log when starting new parse
    setProgressLog([]);
    startParsing();

    try {
      const response = await smartTodosApi.parse(rawInput.trim());

      if (response.data) {
        setParsedResult(
          response.data.sessionId,
          { todos: response.data.todos, suggestedOrder: response.data.suggestedOrder },
          response.data.needsClarification,
          response.data.summary
        );
        onParsed();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse todos');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleParse();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  if (!hasCheckedStatus) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
        <p className="mt-3 text-sm text-theme-muted">Checking Smart Tasks availability...</p>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="text-4xl mb-4">🤖</div>
        <h3 className="text-lg font-medium text-theme-primary mb-2">Smart Tasks Unavailable</h3>
        <p className="text-sm text-theme-muted max-w-md">{availabilityMessage}</p>
        <button
          onClick={onCancel}
          className="mt-6 px-4 py-2 bg-surface-600 text-theme-primary rounded-lg text-sm hover:bg-surface-500 transition-colors"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Input Area */}
      <div className="px-6 py-4">
        <label className="block text-sm text-theme-muted mb-2">
          Describe your tasks in natural language
        </label>
        <textarea
          ref={textareaRef}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Fix the auth bug in the login flow, then add dark mode to settings, and also improve the API performance..."
          className="w-full h-32 px-4 py-3 bg-surface-800 border border-surface-600 rounded-lg text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-accent text-sm font-mono resize-none"
          disabled={state === 'parsing'}
        />
        <p className="mt-2 text-xs text-theme-muted">
          Tip: You can mention multiple tasks, projects, and details. Claude will parse and organize them.
        </p>
      </div>

      {/* Parsing State with Progress Log */}
      {state === 'parsing' && (
        <div className="px-6 py-4 border-t border-surface-600">
          <div className="p-4 bg-surface-800 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
              <div>
                <p className="text-sm font-medium text-theme-primary">Parsing with Claude...</p>
              </div>
            </div>

            {/* Progress Log */}
            {progressLog.length > 0 && (
              <div className="space-y-1.5 mt-3 pt-3 border-t border-surface-700">
                {progressLog.map((log, index) => (
                  <div key={index} className="flex items-start gap-2 text-xs">
                    <span className="text-theme-muted shrink-0">
                      {log.step === 'started' && '▶'}
                      {log.step === 'tool-call' && '🔧'}
                      {log.step === 'tool-result' && '✓'}
                      {log.step === 'completed' && '✅'}
                      {log.step === 'error' && '❌'}
                      {log.step === 'parsing' && '⏳'}
                    </span>
                    <span className={`${
                      log.step === 'tool-call' ? 'text-yellow-400' :
                      log.step === 'error' ? 'text-red-400' :
                      log.step === 'completed' ? 'text-green-400' :
                      'text-theme-secondary'
                    }`}>
                      {log.message}
                      {log.toolName && (
                        <span className="ml-1 text-theme-muted">({log.toolName})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {state === 'error' && (
        <div className="px-6 py-4 border-t border-surface-600">
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="text-red-400">
              <Icons.alertCircle />
            </div>
            <div>
              <p className="text-sm font-medium text-red-400">Failed to parse tasks</p>
              <p className="text-xs text-red-400/70">{useSmartTodosStore.getState().errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-4 border-t border-surface-600 flex items-center justify-between">
        <span className="text-xs text-theme-muted">
          Press{' '}
          <kbd className="px-1.5 py-0.5 bg-surface-800 border border-surface-500 rounded text-xs font-mono">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
          </kbd>{' '}
          to parse
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-theme-muted hover:text-theme-primary transition-colors"
            disabled={state === 'parsing'}
          >
            Cancel
          </button>
          <button
            onClick={handleParse}
            disabled={!rawInput.trim() || state === 'parsing'}
            className="px-4 py-2 bg-accent text-surface-900 rounded-lg font-medium text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {state === 'parsing' ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-surface-900 border-t-transparent rounded-full" />
                Parsing...
              </>
            ) : (
              <>
                <Icons.sparkles />
                Parse Tasks
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
