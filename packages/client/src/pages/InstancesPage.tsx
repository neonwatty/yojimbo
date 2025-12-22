import { useState, useEffect, useCallback } from 'react';
import {
  useInstances,
  useCreateInstance,
  useDeleteInstance,
  useUpdateInstance,
} from '../hooks/use-instances';
import { useAppStore } from '../stores/app-store';
import { InstanceTerminal } from '../components/InstanceTerminal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditableName } from '../components/EditableName';
import { ContextMenu, useContextMenu } from '../components/ContextMenu';
import type { Instance } from '@cc-orchestrator/shared';

// Icons
const Icons = {
  plus: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  close: (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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
  edit: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
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
  tabs: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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
};

export function InstancesPage() {
  const { data: instances = [], isLoading, error } = useInstances();
  const createInstance = useCreateInstance();
  const deleteInstance = useDeleteInstance();
  const updateInstance = useUpdateInstance();

  const { activeInstanceId, setActiveInstance, layout, setLayout } = useAppStore();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWorkingDir, setNewWorkingDir] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Instance | null>(null);

  // Rename state
  const [renamingId, setRenamingId] = useState<string | null>(null);

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

  const handleRename = async (id: string, newName: string) => {
    try {
      await updateInstance.mutateAsync({ id, data: { name: newName } });
      setRenamingId(null);
    } catch (err) {
      console.error('Failed to rename instance:', err);
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

      // ⌘W - Close active instance
      if (isMeta && e.key === 'w' && activeInstance) {
        e.preventDefault();
        setDeleteTarget(activeInstance);
        return;
      }

      // F2 - Rename active instance
      if (e.key === 'F2' && activeInstance) {
        e.preventDefault();
        setRenamingId(activeInstance.id);
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
    [activeInstance, activeInstanceId, instances, setActiveInstance]
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
          label: 'Rename',
          icon: Icons.edit,
          onClick: () => setRenamingId(contextMenuTarget.id),
          shortcut: 'F2',
        },
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
      {/* Tab bar */}
      <div className="h-12 bg-surface-800 border-b border-surface-600 flex items-center px-2 gap-1 overflow-x-auto">
        {instances.map((instance, index) => (
          <Tab
            key={instance.id}
            instance={instance}
            index={index}
            isActive={activeInstanceId === instance.id}
            isRenaming={renamingId === instance.id}
            onClick={() => setActiveInstance(instance.id)}
            onClose={() => setDeleteTarget(instance)}
            onContextMenu={(e) => handleContextMenu(e, instance)}
            onRename={(name) => handleRename(instance.id, name)}
            onRenameEnd={() => setRenamingId(null)}
            onTogglePin={() => handleTogglePin(instance)}
          />
        ))}

        {/* New instance button */}
        <button
          onClick={() => setShowNewDialog(true)}
          className="flex-shrink-0 p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
          title="New instance (⌘N)"
        >
          {Icons.plus}
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Layout switcher */}
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={() => setLayout('tabs')}
            className={`p-1.5 rounded ${layout === 'tabs' ? 'bg-surface-600 text-theme-primary' : 'text-theme-muted hover:text-theme-primary'}`}
            title="Tabs view"
          >
            {Icons.tabs}
          </button>
          <button
            onClick={() => setLayout('cards')}
            className={`p-1.5 rounded ${layout === 'cards' ? 'bg-surface-600 text-theme-primary' : 'text-theme-muted hover:text-theme-primary'}`}
            title="Cards view"
          >
            {Icons.cards}
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
        ) : layout === 'tabs' ? (
          activeInstance ? (
            <InstanceTerminal instanceId={activeInstance.id} className="h-full" />
          ) : (
            <div className="flex items-center justify-center h-full text-theme-muted">
              Select an instance
            </div>
          )
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                isActive={activeInstanceId === instance.id}
                onClick={() => setActiveInstance(instance.id)}
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

function Tab({
  instance,
  index,
  isActive,
  isRenaming,
  onClick,
  onClose,
  onContextMenu,
  onRename,
  onRenameEnd,
  onTogglePin,
}: {
  instance: Instance;
  index: number;
  isActive: boolean;
  isRenaming: boolean;
  onClick: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onRename: (name: string) => void;
  onRenameEnd: () => void;
  onTogglePin: () => void;
}) {
  const statusColors = {
    working: 'bg-state-working',
    awaiting: 'bg-state-awaiting',
    idle: 'bg-state-idle',
    error: 'bg-state-error',
  };

  return (
    <div
      className={`
        group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer
        ${isActive ? 'bg-surface-700 text-theme-primary' : 'text-theme-muted hover:text-theme-primary hover:bg-surface-700'}
      `}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${instance.name} (⌘${index + 1})`}
    >
      {/* Status dot */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColors[instance.status] || statusColors.idle} ${instance.status === 'working' ? 'animate-pulse' : ''}`}
      />

      {/* Pin indicator */}
      {instance.pinned && (
        <span className="text-accent flex-shrink-0" onClick={(e) => { e.stopPropagation(); onTogglePin(); }}>
          {Icons.pinFilled}
        </span>
      )}

      {/* Name */}
      {isRenaming ? (
        <EditableName
          value={instance.name}
          onSave={onRename}
          isEditing={true}
          onEditEnd={onRenameEnd}
          className="max-w-[120px]"
        />
      ) : (
        <span className="truncate max-w-[120px]">{instance.name}</span>
      )}

      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-600 transition-opacity flex-shrink-0"
      >
        {Icons.close}
      </button>
    </div>
  );
}

function InstanceCard({
  instance,
  isActive,
  onClick,
  onContextMenu,
  onTogglePin,
}: {
  instance: Instance;
  isActive: boolean;
  onClick: () => void;
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
        bg-surface-800 rounded-xl border-2 p-4 cursor-pointer relative
        transition-all hover:-translate-y-0.5 hover:shadow-lg
        ${isActive ? 'border-accent' : statusColors[instance.status] || statusColors.idle}
      `}
      onClick={onClick}
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
