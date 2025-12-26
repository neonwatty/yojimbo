import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstancesStore } from '../../store/instancesStore';
import { useUIStore } from '../../store/uiStore';
import { Icons } from './Icons';

interface CommandAction {
  id: string;
  label: string;
  shortcut?: string[];
  category: 'navigation' | 'instances' | 'panels' | 'actions';
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { instances } = useInstancesStore();
  const {
    toggleLeftSidebar,
    toggleEditorPanel,
    toggleTerminalPanel,
    setShowSettingsModal,
    setShowShortcutsModal,
    setShowNewInstanceModal,
  } = useUIStore();

  // Build actions list
  const actions = useMemo<CommandAction[]>(() => {
    const baseActions: CommandAction[] = [
      // Navigation
      {
        id: 'go-home',
        label: 'Go to Home',
        shortcut: ['G', 'H'],
        category: 'navigation',
        action: () => navigate('/'),
        keywords: ['dashboard', 'main'],
      },
      {
        id: 'go-instances',
        label: 'Go to Instances',
        shortcut: ['G', 'I'],
        category: 'navigation',
        action: () => navigate('/instances'),
        keywords: ['sessions', 'terminals'],
      },
      {
        id: 'go-history',
        label: 'Go to History',
        shortcut: ['G', 'S'],
        category: 'navigation',
        action: () => navigate('/history'),
        keywords: ['sessions', 'past'],
      },

      // Instances
      {
        id: 'new-instance',
        label: 'New Instance',
        shortcut: ['Cmd', 'N'],
        category: 'instances',
        action: () => {
          setShowNewInstanceModal(true);
        },
        keywords: ['create', 'add', 'terminal'],
      },

      // Panels
      {
        id: 'toggle-sidebar',
        label: 'Toggle Sidebar',
        shortcut: ['Cmd', 'B'],
        category: 'panels',
        action: toggleLeftSidebar,
        keywords: ['hide', 'show', 'navigation'],
      },
      {
        id: 'toggle-plans',
        label: 'Toggle Plans Panel',
        shortcut: ['Cmd', 'E'],
        category: 'panels',
        action: toggleEditorPanel,
        keywords: ['editor', 'markdown'],
      },
      {
        id: 'toggle-terminal',
        label: 'Toggle Terminal',
        shortcut: ['Cmd', '`'],
        category: 'panels',
        action: toggleTerminalPanel,
        keywords: ['console', 'shell'],
      },

      // Actions
      {
        id: 'open-settings',
        label: 'Open Settings',
        shortcut: ['Cmd', ','],
        category: 'actions',
        action: () => setShowSettingsModal(true),
        keywords: ['preferences', 'config'],
      },
      {
        id: 'show-shortcuts',
        label: 'Show Keyboard Shortcuts',
        shortcut: ['Cmd', '/'],
        category: 'actions',
        action: () => setShowShortcutsModal(true),
        keywords: ['help', 'keys', 'hotkeys'],
      },
    ];

    // Add instance switching actions
    const instanceActions: CommandAction[] = instances.slice(0, 9).map((inst, index) => ({
      id: `switch-instance-${inst.id}`,
      label: `Switch to: ${inst.name}`,
      shortcut: ['Cmd', String(index + 1)],
      category: 'instances' as const,
      action: () => navigate(`/instances/${inst.id}`),
      keywords: [inst.workingDir],
    }));

    return [...baseActions, ...instanceActions];
  }, [instances, navigate, toggleLeftSidebar, toggleEditorPanel, toggleTerminalPanel, setShowSettingsModal, setShowShortcutsModal]);

  // Filter actions based on query
  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;

    const lowerQuery = query.toLowerCase();
    return actions.filter(action => {
      const searchText = [
        action.label,
        ...(action.keywords || []),
      ].join(' ').toLowerCase();
      return searchText.includes(lowerQuery);
    });
  }, [actions, query]);

  // Group actions by category
  const groupedActions = useMemo(() => {
    const groups: Record<string, CommandAction[]> = {};
    filteredActions.forEach(action => {
      if (!groups[action.category]) {
        groups[action.category] = [];
      }
      groups[action.category].push(action);
    });
    return groups;
  }, [filteredActions]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Execute selected action
  const executeAction = useCallback((action: CommandAction) => {
    onClose();
    action.action();
  }, [onClose]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredActions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredActions[selectedIndex]) {
          executeAction(filteredActions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [filteredActions, selectedIndex, executeAction, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    instances: 'Instances',
    panels: 'Panels',
    actions: 'Actions',
  };

  const categoryOrder = ['navigation', 'instances', 'panels', 'actions'];
  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-surface-800 rounded-xl shadow-2xl border border-surface-600 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-surface-600">
          <Icons.search />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 ml-3 bg-transparent text-theme-primary placeholder-theme-muted outline-none text-sm"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-surface-700 text-theme-muted rounded border border-surface-600">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {filteredActions.length === 0 ? (
            <div className="px-4 py-8 text-center text-theme-muted text-sm">
              No commands found
            </div>
          ) : (
            categoryOrder.map(category => {
              const categoryActions = groupedActions[category];
              if (!categoryActions?.length) return null;

              return (
                <div key={category} className="mb-2">
                  <div className="px-2 py-1 text-xs font-medium text-theme-muted uppercase tracking-wide">
                    {categoryLabels[category]}
                  </div>
                  {categoryActions.map(action => {
                    const index = globalIndex++;
                    const isSelected = index === selectedIndex;

                    return (
                      <button
                        key={action.id}
                        data-index={index}
                        onClick={() => executeAction(action)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? 'bg-accent text-surface-900'
                            : 'text-theme-primary hover:bg-surface-700'
                        }`}
                      >
                        <span>{action.label}</span>
                        {action.shortcut && (
                          <div className="flex items-center gap-1">
                            {action.shortcut.map((key, i) => (
                              <kbd
                                key={i}
                                className={`px-1.5 py-0.5 text-xs rounded border ${
                                  isSelected
                                    ? 'bg-surface-900/20 border-surface-900/30 text-surface-900'
                                    : 'bg-surface-700 border-surface-600 text-theme-muted'
                                }`}
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
