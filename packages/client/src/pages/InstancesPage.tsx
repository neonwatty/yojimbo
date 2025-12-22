import { useState, useEffect, useCallback, useRef } from 'react';
import {
  useInstances,
  useCreateInstance,
  useDeleteInstance,
  useUpdateInstance,
} from '../hooks/use-instances';
import { useAppStore } from '../stores/app-store';
import { InstanceTerminal, type InstanceTerminalHandle } from '../components/InstanceTerminal';
import { VanillaTerminal } from '../components/VanillaTerminal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ContextMenu, useContextMenu } from '../components/ContextMenu';
import { PlansPanel } from '../components/PlansPanel';
import type { Instance } from '@cc-orchestrator/shared';

// Icons
const Icons = {
  plus: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  pin: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  ),
  pinFilled: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
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
  cards: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  ),
  list: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  expand: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
  ),
  collapse: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
    </svg>
  ),
  document: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  terminal: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

export function InstancesPage() {
  const { data: instances = [], isLoading, error } = useInstances();
  const createInstance = useCreateInstance();
  const deleteInstance = useDeleteInstance();
  const updateInstance = useUpdateInstance();

  const {
    activeInstanceId,
    setActiveInstance,
    layout,
    setLayout,
    focusMode,
    focusedInstanceId,
    enterFocusMode,
    exitFocusMode,
    plansPanelOpen,
    togglePlansPanel,
    terminalPanelOpen,
    terminalPanelHeight,
    toggleTerminalPanel,
    setTerminalPanelHeight,
  } = useAppStore();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWorkingDir, setNewWorkingDir] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Instance | null>(null);

  // Context menu
  const { contextMenu, openContextMenu, closeContextMenu } = useContextMenu();
  const [contextMenuTarget, setContextMenuTarget] = useState<Instance | null>(null);

  const activeInstance = instances.find((i) => i.id === activeInstanceId);

  // Auto-select first instance if none selected
  useEffect(() => {
    if (!activeInstanceId && instances.length > 0) {
      setActiveInstance(instances[0].id);
    }
  }, [activeInstanceId, instances, setActiveInstance]);

  const handleCreate = async () => {
    if (!newName || !newWorkingDir) return;

    try {
      const instance = await createInstance.mutateAsync({
        name: newName,
        workingDir: newWorkingDir,
      });
      setActiveInstance(instance.id);
      setShowNewDialog(false);
      setNewName('');
      setNewWorkingDir('');
    } catch (err) {
      console.error('Failed to create instance:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteInstance.mutateAsync(deleteTarget.id);
      if (activeInstanceId === deleteTarget.id) {
        const remaining = instances.filter((i) => i.id !== deleteTarget.id);
        setActiveInstance(remaining[0]?.id || null);
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete instance:', err);
    }
  };

  const handleTogglePin = async (instance: Instance) => {
    try {
      await updateInstance.mutateAsync({
        id: instance.id,
        data: { pinned: !instance.pinned },
      });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, instance: Instance) => {
    setContextMenuTarget(instance);
    openContextMenu(e);
  };

  // Keyboard shortcuts for instances page
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // ⌘E - Toggle plans panel (only in focus mode)
      if (isMeta && e.key === 'e' && focusMode) {
        e.preventDefault();
        togglePlansPanel();
        return;
      }

      // ⌘` - Toggle terminal panel (only in focus mode)
      if (isMeta && e.key === '`' && focusMode) {
        e.preventDefault();
        toggleTerminalPanel();
        return;
      }

      // Escape - Exit focus mode
      if (e.key === 'Escape' && focusMode) {
        e.preventDefault();
        exitFocusMode();
        return;
      }

      // Enter - Enter focus mode on active instance
      if (e.key === 'Enter' && !focusMode && activeInstance) {
        e.preventDefault();
        enterFocusMode(activeInstance.id);
        return;
      }

      // ⌘W - Close active instance
      if (isMeta && e.key === 'w' && activeInstance) {
        e.preventDefault();
        setDeleteTarget(activeInstance);
        return;
      }

      // ⌘[ - Previous instance
      if (isMeta && e.key === '[') {
        e.preventDefault();
        const currentIndex = instances.findIndex((i) => i.id === activeInstanceId);
        if (currentIndex > 0) {
          setActiveInstance(instances[currentIndex - 1].id);
        }
        return;
      }

      // ⌘] - Next instance
      if (isMeta && e.key === ']') {
        e.preventDefault();
        const currentIndex = instances.findIndex((i) => i.id === activeInstanceId);
        if (currentIndex < instances.length - 1) {
          setActiveInstance(instances[currentIndex + 1].id);
        }
        return;
      }

      // ⌘1-9 - Switch to instance by number
      if (isMeta && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (instances[index]) {
          setActiveInstance(instances[index].id);
        }
        return;
      }
    },
    [activeInstance, activeInstanceId, instances, setActiveInstance, focusMode, enterFocusMode, exitFocusMode, togglePlansPanel, toggleTerminalPanel]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (error) {
    return (
      <div className="p-6">
        <div className="text-state-error">Error loading instances: {error.message}</div>
      </div>
    );
  }

  const contextMenuItems = contextMenuTarget
    ? [
        {
          label: contextMenuTarget.pinned ? 'Unpin' : 'Pin',
          icon: contextMenuTarget.pinned ? Icons.pinFilled : Icons.pin,
          onClick: () => handleTogglePin(contextMenuTarget),
        },
        {
          label: 'Close',
          icon: Icons.trash,
          onClick: () => setDeleteTarget(contextMenuTarget),
          variant: 'danger' as const,
          shortcut: '⌘W',
        },
      ]
    : [];

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="h-12 bg-surface-800 border-b border-surface-600 flex items-center justify-between px-4">
        {/* Left side: instance count */}
        <div className="flex items-center gap-3">
          <span className="text-theme-secondary text-sm">
            {instances.length} {instances.length === 1 ? 'instance' : 'instances'}
          </span>
          {/* New instance button */}
          <button
            onClick={() => setShowNewDialog(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors text-sm"
            title="New instance (⌘N)"
          >
            {Icons.plus}
            <span>New</span>
          </button>
        </div>

        {/* Right side: Layout switcher */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLayout('cards')}
            className={`p-1.5 rounded ${layout === 'cards' && !focusMode ? 'bg-surface-600 text-theme-primary' : 'text-theme-muted hover:text-theme-primary'}`}
            title="Cards view"
          >
            {Icons.cards}
          </button>
          <button
            onClick={() => setLayout('list')}
            className={`p-1.5 rounded ${layout === 'list' && !focusMode ? 'bg-surface-600 text-theme-primary' : 'text-theme-muted hover:text-theme-primary'}`}
            title="List view"
          >
            {Icons.list}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-theme-muted">Loading...</div>
        ) : instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-theme-muted">
            <p className="mb-4">No instances yet</p>
            <button
              onClick={() => setShowNewDialog(true)}
              className="px-4 py-2 bg-accent hover:bg-accent-bright text-black font-medium rounded-lg transition-colors"
            >
              Create your first instance
            </button>
          </div>
        ) : focusMode && focusedInstanceId ? (
          // Focus mode: expanded instance with thumbnail sidebar
          <FocusModeView
            instances={instances}
            focusedInstanceId={focusedInstanceId}
            onSelectInstance={(id) => enterFocusMode(id)}
            onExitFocus={exitFocusMode}
            onContextMenu={handleContextMenu}
            plansPanelOpen={plansPanelOpen}
            onTogglePlansPanel={togglePlansPanel}
            terminalPanelOpen={terminalPanelOpen}
            terminalPanelHeight={terminalPanelHeight}
            onToggleTerminalPanel={toggleTerminalPanel}
            onSetTerminalPanelHeight={setTerminalPanelHeight}
          />
        ) : layout === 'list' ? (
          // List layout
          <div className="p-4">
            <div className="bg-surface-800 rounded-xl border border-surface-600 overflow-hidden">
              <div className="divide-y divide-surface-600">
                {instances.map((instance) => (
                  <InstanceListRow
                    key={instance.id}
                    instance={instance}
                    isActive={activeInstanceId === instance.id}
                    onClick={() => setActiveInstance(instance.id)}
                    onDoubleClick={() => enterFocusMode(instance.id)}
                    onContextMenu={(e) => handleContextMenu(e, instance)}
                    onTogglePin={() => handleTogglePin(instance)}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Card layout
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                isActive={activeInstanceId === instance.id}
                onClick={() => setActiveInstance(instance.id)}
                onDoubleClick={() => enterFocusMode(instance.id)}
                onContextMenu={(e) => handleContextMenu(e, instance)}
                onTogglePin={() => handleTogglePin(instance)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New instance dialog */}
      {showNewDialog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowNewDialog(false)}
        >
          <div
            className="bg-surface-800 rounded-xl border border-surface-600 p-6 w-full max-w-md mx-4 animate-expand-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-theme-primary mb-4">New Instance</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="My Project"
                  className="w-full px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-secondary mb-1">
                  Working Directory
                </label>
                <input
                  type="text"
                  value={newWorkingDir}
                  onChange={(e) => setNewWorkingDir(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="/path/to/project"
                  className="w-full px-3 py-2 bg-surface-700 border border-surface-600 rounded-lg text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewDialog(false)}
                className="px-4 py-2 text-theme-secondary hover:text-theme-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName || !newWorkingDir || createInstance.isPending}
                className="px-4 py-2 bg-accent hover:bg-accent-bright disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors"
              >
                {createInstance.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Close Instance"
        message={`Are you sure you want to close "${deleteTarget?.name}"? This will terminate any running processes.`}
        confirmLabel="Close"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Context menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        items={contextMenuItems}
        onClose={closeContextMenu}
      />
    </div>
  );
}

function InstanceCard({
  instance,
  isActive,
  onClick,
  onDoubleClick,
  onContextMenu,
  onTogglePin,
}: {
  instance: Instance;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTogglePin: () => void;
}) {
  const statusColors = {
    working: 'border-state-working',
    awaiting: 'border-state-awaiting',
    idle: 'border-surface-600',
    error: 'border-state-error',
  };

  return (
    <div
      className={`
        group bg-surface-800 rounded-xl border-2 p-4 cursor-pointer relative
        transition-all hover:-translate-y-0.5 hover:shadow-lg
        ${isActive ? 'border-accent' : statusColors[instance.status] || statusColors.idle}
      `}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* Pin button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
        }}
        className={`absolute top-3 right-3 p-1 rounded transition-colors ${
          instance.pinned
            ? 'text-accent'
            : 'text-theme-muted opacity-0 group-hover:opacity-100 hover:text-theme-primary'
        }`}
      >
        {instance.pinned ? Icons.pinFilled : Icons.pin}
      </button>

      <div className="flex items-center gap-3 mb-3">
        <span
          className={`w-3 h-3 rounded-full ${instance.status === 'working' ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor:
              instance.status === 'working'
                ? 'var(--state-working)'
                : instance.status === 'awaiting'
                  ? 'var(--state-awaiting)'
                  : instance.status === 'error'
                    ? 'var(--state-error)'
                    : 'var(--state-idle)',
          }}
        />
        <span className="font-medium text-theme-primary truncate pr-8">{instance.name}</span>
      </div>
      <div className="text-sm text-theme-muted truncate">{instance.workingDir}</div>
      <div className="text-xs text-theme-muted mt-2 capitalize">{instance.status}</div>
    </div>
  );
}

// List row component
function InstanceListRow({
  instance,
  isActive,
  onClick,
  onDoubleClick,
  onContextMenu,
  onTogglePin,
}: {
  instance: Instance;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTogglePin: () => void;
}) {
  const statusConfig = {
    working: { bg: 'bg-state-working/10', text: 'text-state-working', border: 'border-state-working/30', label: 'Working' },
    awaiting: { bg: 'bg-state-awaiting/10', text: 'text-state-awaiting', border: 'border-state-awaiting/30', label: 'Awaiting' },
    idle: { bg: 'bg-state-idle/10', text: 'text-state-idle', border: 'border-state-idle/30', label: 'Idle' },
    error: { bg: 'bg-state-error/10', text: 'text-state-error', border: 'border-state-error/30', label: 'Error' },
  };

  const config = statusConfig[instance.status] || statusConfig.idle;

  return (
    <div
      className={`
        group flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors
        ${isActive ? 'bg-surface-700' : 'hover:bg-surface-700'}
      `}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {/* Status dot */}
      <span
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${instance.status === 'working' ? 'animate-pulse' : ''}`}
        style={{
          backgroundColor:
            instance.status === 'working'
              ? 'var(--state-working)'
              : instance.status === 'awaiting'
                ? 'var(--state-awaiting)'
                : instance.status === 'error'
                  ? 'var(--state-error)'
                  : 'var(--state-idle)',
        }}
      />

      {/* Pin indicator */}
      {instance.pinned && (
        <span className="text-accent flex-shrink-0">
          {Icons.pinFilled}
        </span>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="font-medium text-theme-primary truncate block">{instance.name}</span>
        <span className="text-sm text-theme-muted truncate block">{instance.workingDir}</span>
      </div>

      {/* Status badge */}
      <span
        className={`
          inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
          border ${config.bg} ${config.text} ${config.border}
        `}
      >
        {config.label}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={`p-1.5 rounded hover:bg-surface-600 transition-colors ${
            instance.pinned ? 'text-accent' : 'text-theme-muted hover:text-theme-primary'
          }`}
          title={instance.pinned ? 'Unpin' : 'Pin'}
        >
          {instance.pinned ? Icons.pinFilled : Icons.pin}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDoubleClick();
          }}
          className="p-1.5 rounded text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
          title="Focus mode"
        >
          {Icons.expand}
        </button>
      </div>
    </div>
  );
}

// Focus mode view component
function FocusModeView({
  instances,
  focusedInstanceId,
  onSelectInstance,
  onExitFocus,
  onContextMenu,
  plansPanelOpen,
  onTogglePlansPanel,
  terminalPanelOpen,
  terminalPanelHeight,
  onToggleTerminalPanel,
  onSetTerminalPanelHeight,
}: {
  instances: Instance[];
  focusedInstanceId: string;
  onSelectInstance: (id: string) => void;
  onExitFocus: () => void;
  onContextMenu: (e: React.MouseEvent, instance: Instance) => void;
  plansPanelOpen: boolean;
  onTogglePlansPanel: () => void;
  terminalPanelOpen: boolean;
  terminalPanelHeight: number;
  onToggleTerminalPanel: () => void;
  onSetTerminalPanelHeight: (height: number) => void;
}) {
  const focusedInstance = instances.find((i) => i.id === focusedInstanceId);
  const otherInstances = instances.filter((i) => i.id !== focusedInstanceId);
  const terminalRef = useRef<InstanceTerminalHandle>(null);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // Handle injecting plan content to terminal
  const handleInjectToTerminal = useCallback((content: string) => {
    if (terminalRef.current) {
      terminalRef.current.sendToTerminal(content);
    }
  }, []);

  // Handle vertical resize of terminal panel
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = {
      startY: e.clientY,
      startHeight: terminalPanelHeight,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startY - e.clientY;
      const newHeight = resizeRef.current.startHeight + delta;
      onSetTerminalPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [terminalPanelHeight, onSetTerminalPanelHeight]);

  if (!focusedInstance) return null;

  return (
    <div className="h-full flex">
      {/* Main focused terminal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Focus header */}
        <div className="h-10 bg-surface-800 border-b border-surface-600 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full ${focusedInstance.status === 'working' ? 'animate-pulse' : ''}`}
              style={{
                backgroundColor:
                  focusedInstance.status === 'working'
                    ? 'var(--state-working)'
                    : focusedInstance.status === 'awaiting'
                      ? 'var(--state-awaiting)'
                      : focusedInstance.status === 'error'
                        ? 'var(--state-error)'
                        : 'var(--state-idle)',
              }}
            />
            <span className="font-medium text-theme-primary">{focusedInstance.name}</span>
            <span className="text-sm text-theme-muted">{focusedInstance.workingDir}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTerminalPanel}
              className={`p-1.5 rounded transition-colors ${
                terminalPanelOpen
                  ? 'bg-accent text-black'
                  : 'text-theme-muted hover:text-theme-primary hover:bg-surface-700'
              }`}
              title="Toggle terminal panel (⌘`)"
            >
              {Icons.terminal}
            </button>
            <button
              onClick={onTogglePlansPanel}
              className={`p-1.5 rounded transition-colors ${
                plansPanelOpen
                  ? 'bg-accent text-black'
                  : 'text-theme-muted hover:text-theme-primary hover:bg-surface-700'
              }`}
              title="Toggle plans panel (⌘E)"
            >
              {Icons.document}
            </button>
            <button
              onClick={onExitFocus}
              className="p-1.5 rounded text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
              title="Exit focus mode (Esc)"
            >
              {Icons.collapse}
            </button>
          </div>
        </div>

        {/* Terminal content area */}
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Main Claude Code terminal */}
          <div className="flex-1 min-h-0">
            <InstanceTerminal ref={terminalRef} instanceId={focusedInstanceId} className="h-full" />
          </div>

          {/* Vanilla terminal panel (bottom) */}
          {terminalPanelOpen && (
            <>
              {/* Resize handle */}
              <div
                className="h-1 bg-surface-600 hover:bg-accent cursor-ns-resize flex-shrink-0 transition-colors"
                onMouseDown={handleResizeMouseDown}
              />
              {/* Vanilla terminal */}
              <div
                className="bg-surface-900 flex-shrink-0"
                style={{ height: terminalPanelHeight }}
              >
                <VanillaTerminal
                  workingDir={focusedInstance.workingDir}
                  className="h-full"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Thumbnail sidebar */}
      {otherInstances.length > 0 && !plansPanelOpen && (
        <div className="w-48 bg-surface-800 border-l border-surface-600 overflow-y-auto">
          <div className="p-2 text-xs font-medium text-theme-muted uppercase tracking-wider">
            Other Instances
          </div>
          <div className="space-y-1 px-2 pb-2">
            {otherInstances.map((instance) => (
              <ThumbnailInstance
                key={instance.id}
                instance={instance}
                onClick={() => onSelectInstance(instance.id)}
                onContextMenu={(e) => onContextMenu(e, instance)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Plans panel */}
      {plansPanelOpen && (
        <div className="w-[450px] border-l border-surface-600 flex-shrink-0">
          <PlansPanel
            workingDir={focusedInstance.workingDir}
            onInjectToTerminal={handleInjectToTerminal}
          />
        </div>
      )}
    </div>
  );
}

// Thumbnail instance for focus mode sidebar
function ThumbnailInstance({
  instance,
  onClick,
  onContextMenu,
}: {
  instance: Instance;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="group p-2 rounded-lg bg-surface-700 hover:bg-surface-600 cursor-pointer transition-colors"
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${instance.status === 'working' ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor:
              instance.status === 'working'
                ? 'var(--state-working)'
                : instance.status === 'awaiting'
                  ? 'var(--state-awaiting)'
                  : instance.status === 'error'
                    ? 'var(--state-error)'
                    : 'var(--state-idle)',
          }}
        />
        {instance.pinned && (
          <span className="text-accent text-xs">{Icons.pinFilled}</span>
        )}
        <span className="text-xs font-medium text-theme-primary truncate flex-1">
          {instance.name}
        </span>
      </div>
      <div className="text-[10px] text-theme-muted truncate">{instance.workingDir}</div>
    </div>
  );
}
