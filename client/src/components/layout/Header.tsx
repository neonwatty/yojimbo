import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/uiStore';
import { useInstancesStore } from '../../store/instancesStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useFeedStore } from '../../store/feedStore';
import { useTasksStore } from '../../store/tasksStore';
import { Icons } from '../common/Icons';
import Tooltip from '../common/Tooltip';
import { ConnectionStatus } from '../common/ConnectionStatus';
import { SummaryModal } from '../modals/SummaryModal';
import { GlobalTasksPanel } from '../tasks/GlobalTasksPanel';
import { toast } from '../../store/toastStore';
import type { SummaryType, GenerateSummaryResponse, CommandExecution, SummarySSEEvent } from '@cc-orchestrator/shared';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  // Summary menu state
  const [showSummaryMenu, setShowSummaryMenu] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryType, setSummaryType] = useState<SummaryType>('daily');
  const [summaryData, setSummaryData] = useState<GenerateSummaryResponse | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingCommands, setStreamingCommands] = useState<CommandExecution[]>([]);
  const summaryMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use selectors for better performance
  const layout = useUIStore((state) => state.layout);
  const setLayout = useUIStore((state) => state.setLayout);
  const setShowShortcutsModal = useUIStore((state) => state.setShowShortcutsModal);
  const setShowSettingsModal = useUIStore((state) => state.setShowSettingsModal);
  const setShowNewInstanceModal = useUIStore((state) => state.setShowNewInstanceModal);
  const openNewInstanceModal = useUIStore((state) => state.openNewInstanceModal);
  const instances = useInstancesStore((state) => state.instances);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const showActivityInNav = useSettingsStore((state) => state.showActivityInNav);
  const summaryIncludePRs = useSettingsStore((state) => state.summaryIncludePRs);
  const summaryIncludeCommits = useSettingsStore((state) => state.summaryIncludeCommits);
  const summaryIncludeIssues = useSettingsStore((state) => state.summaryIncludeIssues);
  const summaryCustomPrompt = useSettingsStore((state) => state.summaryCustomPrompt);
  const unreadCount = useFeedStore((state) => state.stats.unread);
  const showTasksPanel = useUIStore((state) => state.showTasksPanel);
  const setShowTasksPanel = useUIStore((state) => state.setShowTasksPanel);
  const pendingTaskCount = useTasksStore((state) => state.stats.captured + state.stats.inProgress);

  // Close summary menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (summaryMenuRef.current && !summaryMenuRef.current.contains(event.target as Node)) {
        setShowSummaryMenu(false);
      }
    };

    if (showSummaryMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSummaryMenu]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const generateSummaryWithStreaming = useCallback(async (type: SummaryType) => {
    setShowSummaryMenu(false);
    setSummaryType(type);
    setSummaryData(null);
    setStreamingCommands([]);
    setIsLoadingSummary(true);
    setIsStreaming(true);
    setShowSummaryModal(true);

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/summaries/generate-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          includePRs: summaryIncludePRs,
          includeCommits: summaryIncludeCommits,
          includeIssues: summaryIncludeIssues,
          customPrompt: summaryCustomPrompt || undefined,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to start summary generation');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;

      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (done) break;
        const value = result.value;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SummarySSEEvent = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'command_start':
                  setStreamingCommands(prev => [
                    ...prev,
                    { command: event.command, status: 'running' }
                  ]);
                  break;

                case 'command_complete':
                  setStreamingCommands(prev =>
                    prev.map((cmd, i) =>
                      i === event.index
                        ? {
                            ...cmd,
                            status: event.success ? 'success' : 'error',
                            resultCount: event.resultCount,
                          }
                        : cmd
                    )
                  );
                  break;

                case 'summary_complete':
                  setSummaryData(event.data);
                  setIsStreaming(false);
                  setIsLoadingSummary(false);
                  break;

                case 'error':
                  toast.error(event.message);
                  setIsStreaming(false);
                  setIsLoadingSummary(false);
                  break;
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE event:', line);
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      console.error('Failed to generate summary:', error);
      toast.error('Failed to generate summary');
      setIsStreaming(false);
      setIsLoadingSummary(false);
    }
  }, [summaryIncludePRs, summaryIncludeCommits, summaryIncludeIssues, summaryCustomPrompt]);

  const handleCloseSummaryModal = useCallback(() => {
    // Abort any ongoing request when closing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setShowSummaryModal(false);
    setIsStreaming(false);
    setIsLoadingSummary(false);
  }, []);

  const pinnedCount = instances.filter((i) => i.isPinned).length;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const isHistoryView = location.pathname === '/history';
  const isActivityView = location.pathname === '/activity';

  return (
    <header className="h-10 flex items-center justify-between px-3 bg-surface-800 border-b border-surface-600">
      <div className="flex items-center gap-3">
        <h1
          className="text-sm font-semibold text-theme-primary cursor-pointer hover:text-frost-2 transition-colors"
          onClick={() => navigate('/')}
          title="Go to Home"
        >
          <span className="text-accent font-bold">Yo</span>jimbo
        </h1>
        <span className="text-surface-500">│</span>
        <div className="flex items-center gap-3">
          <div className="text-xs text-theme-dim">
            {instances.length} {instances.length === 1 ? 'instance' : 'instances'}
            {pinnedCount > 0 && (
              <span className="ml-1 text-accent">({pinnedCount} pinned)</span>
            )}
          </div>
          <ConnectionStatus />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* New Instance Button */}
        <Tooltip text="New Instance (⌘N)" position="bottom">
          <button
            onClick={() => setShowNewInstanceModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-accent text-surface-900 hover:bg-accent-bright transition-colors"
          >
            <Icons.plus />
            <span className="hidden sm:inline">New</span>
          </button>
        </Tooltip>

        <span className="text-surface-600 mx-1">│</span>

        {/* History Button */}
        <Tooltip text={isHistoryView ? 'Close history' : 'View history'} position="bottom">
          <button
            onClick={() => navigate(isHistoryView ? '/instances' : '/history')}
            className={`px-2 py-1 rounded text-xs transition-colors
              ${isHistoryView
                ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                : 'text-theme-dim hover:text-theme-primary hover:bg-surface-700'}`}
          >
            History
          </button>
        </Tooltip>

        {/* Activity Button */}
        {showActivityInNav && (
          <Tooltip text={isActivityView ? 'Close activity' : 'View activity'} position="bottom">
            <button
              onClick={() => navigate(isActivityView ? '/instances' : '/activity')}
              className={`relative px-2 py-1 rounded text-xs transition-colors
                ${isActivityView
                  ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                  : 'text-theme-dim hover:text-theme-primary hover:bg-surface-700'}`}
            >
              Activity
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[10px] font-bold bg-accent text-surface-900 rounded-full">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </Tooltip>
        )}

        {/* Tasks Button */}
        <Tooltip text="Global tasks (⌘G)" position="bottom">
          <button
            onClick={() => setShowTasksPanel(true)}
            className={`relative px-2 py-1 rounded text-xs transition-colors
              ${showTasksPanel
                ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                : 'text-theme-dim hover:text-theme-primary hover:bg-surface-700'}`}
          >
            Tasks
            {pendingTaskCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[10px] font-bold bg-accent text-surface-900 rounded-full">
                {pendingTaskCount > 99 ? '99+' : pendingTaskCount}
              </span>
            )}
          </button>
        </Tooltip>

        {/* Summary Button with Dropdown */}
        <div className="relative" ref={summaryMenuRef}>
          <Tooltip text="Generate work summary" position="bottom">
            <button
              onClick={() => setShowSummaryMenu(!showSummaryMenu)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors
                ${showSummaryMenu
                  ? 'bg-surface-600 text-theme-primary'
                  : 'text-theme-dim hover:text-theme-primary hover:bg-surface-700'}`}
            >
              Summary
              <Icons.chevronDown />
            </button>
          </Tooltip>
          {showSummaryMenu && (
            <div className="absolute right-0 mt-1 w-44 bg-surface-700 border border-surface-600 rounded z-50 py-1">
              <button
                onClick={() => generateSummaryWithStreaming('daily')}
                className="w-full px-3 py-1.5 text-xs text-left text-theme-primary hover:bg-surface-600 transition-colors"
              >
                Daily Summary
              </button>
              <button
                onClick={() => generateSummaryWithStreaming('weekly')}
                className="w-full px-3 py-1.5 text-xs text-left text-theme-primary hover:bg-surface-600 transition-colors"
              >
                Weekly Summary
              </button>
            </div>
          )}
        </div>

        <span className="text-surface-600 mx-1">│</span>

        {/* Layout Switcher */}
        <div className="flex items-center bg-surface-700 rounded p-0.5" role="group" aria-label="View layout">
          <button
            onClick={() => {
              setLayout('cards');
              navigate('/instances');
            }}
            className={`px-2 py-0.5 rounded text-xs transition-colors
              ${layout === 'cards' ? 'bg-surface-600 text-theme-primary' : 'text-theme-dim hover:text-theme-primary'}`}
            title="Cards"
            aria-label="Card layout"
            aria-pressed={layout === 'cards'}
          >
            ⊟
          </button>
          <button
            onClick={() => {
              setLayout('list');
              navigate('/instances');
            }}
            className={`px-2 py-0.5 rounded text-xs transition-colors
              ${layout === 'list' ? 'bg-surface-600 text-theme-primary' : 'text-theme-dim hover:text-theme-primary'}`}
            title="List"
            aria-label="List layout"
            aria-pressed={layout === 'list'}
          >
            ☰
          </button>
        </div>

        <span className="text-surface-600 mx-1">│</span>

        {/* Theme Toggle */}
        <Tooltip text={isDark ? 'Light mode' : 'Dark mode'} position="bottom">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-1.5 rounded text-theme-dim hover:text-state-awaiting hover:bg-surface-700 transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Icons.sun /> : <Icons.moon />}
          </button>
        </Tooltip>

        {/* Settings */}
        <Tooltip text="Settings (⌘,)" position="bottom">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 rounded text-theme-dim hover:text-theme-primary hover:bg-surface-700 transition-colors"
            aria-label="Open settings"
          >
            <Icons.settings />
          </button>
        </Tooltip>

        {/* Keyboard Shortcuts */}
        <Tooltip text="Keyboard shortcuts (⌘?)" position="bottom">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-1.5 rounded text-theme-dim hover:text-theme-primary hover:bg-surface-700 transition-colors"
            aria-label="View keyboard shortcuts"
          >
            <Icons.help />
          </button>
        </Tooltip>
      </div>

      {/* Summary Modal */}
      <SummaryModal
        isOpen={showSummaryModal}
        onClose={handleCloseSummaryModal}
        summaryType={summaryType}
        summaryData={summaryData}
        isLoading={isLoadingSummary}
        streamingCommands={streamingCommands}
        isStreaming={isStreaming}
      />

      {/* Global Tasks Panel */}
      <GlobalTasksPanel
        isOpen={showTasksPanel}
        onClose={() => setShowTasksPanel(false)}
        onOpenNewInstance={(options) => {
          setShowTasksPanel(false);
          // When dispatching a task to a new instance, default to Claude Code mode
          openNewInstanceModal({ defaultMode: 'claude-code' });
        }}
      />
    </header>
  );
}
