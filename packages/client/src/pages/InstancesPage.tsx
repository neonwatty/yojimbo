import { useState } from 'react';
import { useInstances, useCreateInstance, useDeleteInstance } from '../hooks/use-instances';
import { useAppStore } from '../stores/app-store';
import { InstanceTerminal } from '../components/InstanceTerminal';
import type { Instance } from '@cc-orchestrator/shared';

export function InstancesPage() {
  const { data: instances = [], isLoading, error } = useInstances();
  const createInstance = useCreateInstance();
  const deleteInstance = useDeleteInstance();

  const { activeInstanceId, setActiveInstance, layout, setLayout } = useAppStore();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWorkingDir, setNewWorkingDir] = useState('');

  const activeInstance = instances.find((i) => i.id === activeInstanceId);

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to close this instance?')) return;

    try {
      await deleteInstance.mutateAsync(id);
      if (activeInstanceId === id) {
        setActiveInstance(instances.find((i) => i.id !== id)?.id || null);
      }
    } catch (err) {
      console.error('Failed to delete instance:', err);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="text-state-error">Error loading instances: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="h-12 bg-surface-800 border-b border-surface-600 flex items-center px-2 gap-1 overflow-x-auto">
        {instances.map((instance) => (
          <Tab
            key={instance.id}
            instance={instance}
            isActive={activeInstanceId === instance.id}
            onClick={() => setActiveInstance(instance.id)}
            onClose={() => handleDelete(instance.id)}
          />
        ))}

        {/* New instance button */}
        <button
          onClick={() => setShowNewDialog(true)}
          className="flex-shrink-0 p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
          title="New instance (⌘N)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
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
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setLayout('cards')}
            className={`p-1.5 rounded ${layout === 'cards' ? 'bg-surface-600 text-theme-primary' : 'text-theme-muted hover:text-theme-primary'}`}
            title="Cards view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-theme-muted">
            Loading...
          </div>
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
          // Tabs layout - show active terminal
          activeInstance ? (
            <InstanceTerminal instanceId={activeInstance.id} className="h-full" />
          ) : (
            <div className="flex items-center justify-center h-full text-theme-muted">
              Select an instance
            </div>
          )
        ) : (
          // Cards layout
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instances.map((instance) => (
              <InstanceCard
                key={instance.id}
                instance={instance}
                isActive={activeInstanceId === instance.id}
                onClick={() => setActiveInstance(instance.id)}
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
            className="bg-surface-800 rounded-xl border border-surface-600 p-6 w-full max-w-md mx-4"
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
    </div>
  );
}

function Tab({
  instance,
  isActive,
  onClick,
  onClose,
}: {
  instance: Instance;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
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
    >
      <span
        className={`w-2 h-2 rounded-full ${statusColors[instance.status] || statusColors.idle} ${instance.status === 'working' ? 'animate-pulse' : ''}`}
      />
      <span className="truncate max-w-[120px]">{instance.name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-surface-600 transition-opacity"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function InstanceCard({
  instance,
  isActive,
  onClick,
}: {
  instance: Instance;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusColors = {
    working: 'border-state-working',
    awaiting: 'border-state-awaiting',
    idle: 'border-surface-600',
    error: 'border-state-error',
  };

  const statusBg = {
    working: 'bg-state-working/10',
    awaiting: 'bg-state-awaiting/10',
    idle: 'bg-surface-700',
    error: 'bg-state-error/10',
  };

  return (
    <div
      className={`
        bg-surface-800 rounded-xl border-2 p-4 cursor-pointer
        transition-all hover:-translate-y-0.5 hover:shadow-lg
        ${isActive ? 'border-accent' : statusColors[instance.status] || statusColors.idle}
      `}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`w-3 h-3 rounded-full ${statusBg[instance.status]} ${instance.status === 'working' ? 'animate-pulse' : ''}`}
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
        <span className="font-medium text-theme-primary truncate">{instance.name}</span>
      </div>
      <div className="text-sm text-theme-muted truncate">{instance.workingDir}</div>
      <div className="text-xs text-theme-muted mt-2 capitalize">{instance.status}</div>
    </div>
  );
}
