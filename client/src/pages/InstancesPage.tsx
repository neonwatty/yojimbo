import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInstancesStore } from '../store/instancesStore';
import { useUIStore } from '../store/uiStore';
import { useSettingsStore } from '../store/settingsStore';
import { Terminal } from '../components/terminal';
import { CardLayout } from '../components/instances/CardLayout';
import { ListLayout } from '../components/instances/ListLayout';
import { PlansPanel } from '../components/plans';
import { StatusDot, StatusBadge } from '../components/common/Status';
import { EditableName } from '../components/common/EditableName';
import { Icons } from '../components/common/Icons';
import { instancesApi } from '../api/client';
import type { Instance } from '@cc-orchestrator/shared';

export default function InstancesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { instances, setActiveInstanceId, updateInstance, removeInstance, reorderInstances } = useInstancesStore();
  const { layout, editorPanelOpen, toggleEditorPanel, setEditorPanelOpen, terminalPanelOpen, toggleTerminalPanel, panelWidth, setPanelWidth } = useUIStore();
  const { theme } = useSettingsStore();

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Confirm dialog state
  const [confirmInstance, setConfirmInstance] = useState<Instance | null>(null);

  const handleSelect = useCallback((instanceId: string) => {
    setActiveInstanceId(instanceId);
  }, [setActiveInstanceId]);

  const handleExpand = useCallback((instanceId: string) => {
    navigate(`/instances/${instanceId}`);
  }, [navigate]);

  const handleTogglePin = useCallback(async (instanceId: string) => {
    const instance = instances.find(i => i.id === instanceId);
    if (instance) {
      try {
        await instancesApi.update(instanceId, { isPinned: !instance.isPinned });
        updateInstance(instanceId, { isPinned: !instance.isPinned });
      } catch (error) {
        console.error('Failed to toggle pin:', error);
      }
    }
  }, [instances, updateInstance]);

  const handleClose = useCallback((instance: Instance) => {
    if (instance.status === 'working' || instance.status === 'awaiting' || instance.isPinned) {
      setConfirmInstance(instance);
    } else {
      performClose(instance.id);
    }
  }, []);

  const performClose = useCallback(async (instanceId: string) => {
    try {
      await instancesApi.close(instanceId);
      removeInstance(instanceId);
      if (id === instanceId) {
        navigate('/instances');
      }
    } catch (error) {
      console.error('Failed to close instance:', error);
    }
  }, [id, navigate, removeInstance]);

  const handleReorder = useCallback(async (draggedId: string, targetId: string) => {
    const draggedIndex = instances.findIndex(i => i.id === draggedId);
    const targetIndex = instances.findIndex(i => i.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newOrder = [...instances];
    const [dragged] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, dragged);

    const instanceIds = newOrder.map(i => i.id);
    reorderInstances(instanceIds);

    try {
      await instancesApi.reorder({ instanceIds });
    } catch (error) {
      console.error('Failed to save order:', error);
    }
  }, [instances, reorderInstances]);

  const handleNewInstance = useCallback(async () => {
    try {
      const response = await instancesApi.create({
        name: `instance-${instances.length + 1}`,
        workingDir: '~',
      });
      if (response.data) {
        navigate(`/instances/${response.data.id}`);
      }
    } catch (error) {
      console.error('Failed to create instance:', error);
    }
  }, [instances.length, navigate]);

  const handleStartEditing = useCallback((instanceId: string, name: string) => {
    setEditingId(instanceId);
    setEditingName(name);
  }, []);

  const handleConfirmRename = useCallback(async (instanceId: string) => {
    if (editingName.trim() && editingName !== instances.find(i => i.id === instanceId)?.name) {
      try {
        await instancesApi.update(instanceId, { name: editingName.trim() });
        updateInstance(instanceId, { name: editingName.trim() });
      } catch (error) {
        console.error('Failed to rename:', error);
      }
    }
    setEditingId(null);
    setEditingName('');
  }, [editingName, instances, updateInstance]);

  const handleCancelEditing = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  // Expanded view for a specific instance
  if (id) {
    const instance = instances.find((i) => i.id === id);
    if (!instance) {
      return (
        <div className="flex-1 flex items-center justify-center bg-surface-800">
          <div className="text-center">
            <p className="text-theme-muted mb-4">Instance not found</p>
            <button
              onClick={() => navigate('/instances')}
              className="px-4 py-2 bg-surface-700 text-theme-primary rounded-lg hover:bg-surface-600"
            >
              Back to Instances
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col bg-surface-900 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-800 border-b border-surface-600 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/instances')}
              className="p-1.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-gray-400 hover:text-gray-200 transition-colors"
              title="Back to overview (Escape)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <StatusDot status={instance.status} size="lg" />
            <EditableName
              name={instance.name}
              isEditing={editingId === instance.id}
              editingValue={editingName}
              onStartEdit={() => handleStartEditing(instance.id, instance.name)}
              onValueChange={setEditingName}
              onConfirm={() => handleConfirmRename(instance.id)}
              onCancel={handleCancelEditing}
              className="text-lg"
            />
            <StatusBadge status={instance.status} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleEditorPanel}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${editorPanelOpen
                  ? 'bg-accent text-surface-900'
                  : 'text-theme-muted hover:text-theme-primary hover:bg-surface-700'}`}
            >
              <Icons.file />
              <span>Plans</span>
            </button>
            <button
              onClick={toggleTerminalPanel}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${terminalPanelOpen
                  ? 'bg-accent text-surface-900'
                  : 'text-theme-muted hover:text-theme-primary hover:bg-surface-700'}`}
            >
              <Icons.terminal />
              <span>Terminal</span>
            </button>
            <span className="text-xs text-gray-500 font-mono font-light">{instance.workingDir}</span>
          </div>
        </div>

        {/* Terminal + Plans Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Terminal */}
          {terminalPanelOpen && (
            <div className="flex-1 overflow-hidden">
              <Terminal
                instanceId={instance.id}
                theme={theme === 'dark' ? 'dark' : 'light'}
              />
            </div>
          )}

          {/* Plans Panel */}
          <PlansPanel
            workingDir={instance.workingDir}
            isOpen={editorPanelOpen}
            onClose={() => setEditorPanelOpen(false)}
            width={panelWidth}
            onWidthChange={setPanelWidth}
          />

          {/* Empty state when both panels are closed */}
          {!terminalPanelOpen && !editorPanelOpen && (
            <div className="flex-1 flex items-center justify-center bg-surface-800">
              <div className="text-center text-theme-muted">
                <Icons.terminal />
                <p className="mt-2 text-sm">Use the buttons above to show Terminal or Plans</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Grid/List view
  return (
    <div className="flex-1 overflow-auto bg-surface-800">
      {layout === 'cards' ? (
        <CardLayout
          instances={instances}
          activeId={null}
          onSelect={handleSelect}
          onTogglePin={handleTogglePin}
          onClose={handleClose}
          onExpand={handleExpand}
          onReorder={handleReorder}
          onNewInstance={handleNewInstance}
          editingId={editingId}
          editingName={editingName}
          onStartEditing={handleStartEditing}
          onEditingNameChange={setEditingName}
          onConfirmRename={handleConfirmRename}
          onCancelEditing={handleCancelEditing}
        />
      ) : (
        <ListLayout
          instances={instances}
          activeId={null}
          onSelect={handleSelect}
          onTogglePin={handleTogglePin}
          onClose={handleClose}
          onExpand={handleExpand}
          onReorder={handleReorder}
          editingId={editingId}
          editingName={editingName}
          onStartEditing={handleStartEditing}
          onEditingNameChange={setEditingName}
          onConfirmRename={handleConfirmRename}
          onCancelEditing={handleCancelEditing}
        />
      )}

      {instances.length === 0 && (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="text-center">
            <div className="text-6xl mb-4">🖥️</div>
            <h3 className="text-xl font-semibold text-theme-primary mb-2">No instances yet</h3>
            <p className="text-theme-muted mb-4">Create your first Claude Code instance to get started.</p>
            <button
              onClick={handleNewInstance}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-surface-900 font-medium rounded-lg hover:bg-accent-bright transition-colors"
            >
              <Icons.plus />
              Create Instance
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmInstance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card-elevated rounded-xl p-6 max-w-md shadow-2xl bg-surface-700">
            <h3 className="text-lg font-semibold mb-2 text-theme-primary">Close Instance</h3>
            <p className="text-theme-muted mb-6">
              {confirmInstance.status === 'working'
                ? `"${confirmInstance.name}" is currently working. Are you sure you want to close it?`
                : confirmInstance.status === 'awaiting'
                ? `"${confirmInstance.name}" is awaiting input. Are you sure you want to close it?`
                : confirmInstance.isPinned
                ? `"${confirmInstance.name}" is pinned. Are you sure you want to close it?`
                : `Close "${confirmInstance.name}"?`}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmInstance(null)}
                className="px-4 py-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  performClose(confirmInstance.id);
                  setConfirmInstance(null);
                }}
                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
              >
                Close Instance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
