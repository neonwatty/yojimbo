import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDisplayLabel, isDevMode } from '../../config';
import { useInstancesStore } from '../../store/instancesStore';
import { useUIStore } from '../../store/uiStore';
import { StatusDot } from '../common/Status';
import Tooltip from '../common/Tooltip';
import { Icons } from '../common/Icons';
import { instancesApi } from '../../api/client';
import { EditableName } from '../common/EditableName';
import type { Instance } from '@cc-orchestrator/shared';

export function LeftSidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract instance ID from URL path (since we're outside Routes, useParams doesn't work)
  const expandedId = useMemo(() => {
    const match = location.pathname.match(/\/instances\/([^/]+)/);
    return match ? match[1] : undefined;
  }, [location.pathname]);

  // Use selectors for better performance
  const instances = useInstancesStore((state) => state.instances);
  const activeInstanceId = useInstancesStore((state) => state.activeInstanceId);
  const setActiveInstanceId = useInstancesStore((state) => state.setActiveInstanceId);
  const removeInstance = useInstancesStore((state) => state.removeInstance);
  const updateInstance = useInstancesStore((state) => state.updateInstance);
  const currentCwds = useInstancesStore((state) => state.currentCwds);
  const leftSidebarOpen = useUIStore((state) => state.leftSidebarOpen);
  const leftSidebarWidth = useUIStore((state) => state.leftSidebarWidth);
  const setLeftSidebarWidth = useUIStore((state) => state.setLeftSidebarWidth);
  const toggleLeftSidebar = useUIStore((state) => state.toggleLeftSidebar);
  const setShowNewInstanceModal = useUIStore((state) => state.setShowNewInstanceModal);

  // Resize handler for draggable sidebar edge
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 180), 400);
      setLeftSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const pinnedInstances = useMemo(() => instances.filter((i) => i.isPinned), [instances]);
  const unpinnedInstances = useMemo(() => instances.filter((i) => !i.isPinned), [instances]);

  // Get the index for keyboard shortcut badge (1-9)
  const getInstanceIndex = (instId: string): number | null => {
    const idx = instances.findIndex(i => i.id === instId);
    return idx >= 0 && idx < 9 ? idx + 1 : null;
  };

  // Helper function to display working directory with ~ shortening
  const getWorkingDirDisplay = (inst: Instance): string => {
    const cwd = currentCwds[inst.id] || inst.workingDir;
    if (!cwd) return 'No working directory';
    // Shorten /Users/username/... to ~/...
    const homeDir = '/Users/' + cwd.split('/')[2]; // Extract username
    if (cwd.startsWith(homeDir)) {
      return cwd.replace(homeDir, '~');
    }
    return cwd;
  };

  // Confirmation dialog state
  const [confirmInstance, setConfirmInstance] = useState<Instance | null>(null);

  // Inline rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const handleStartEditing = useCallback((inst: Instance) => {
    setEditingId(inst.id);
    setEditingName(inst.name);
  }, []);

  const handleConfirmRename = useCallback(async () => {
    if (editingId && editingName.trim() && editingName !== instances.find(i => i.id === editingId)?.name) {
      try {
        await instancesApi.update(editingId, { name: editingName.trim() });
        updateInstance(editingId, { name: editingName.trim() });
      } catch {
        // Error toast already shown by API layer
      }
    }
    setEditingId(null);
    setEditingName('');
  }, [editingId, editingName, instances, updateInstance]);

  const handleCancelEditing = useCallback(() => {
    setEditingId(null);
    setEditingName('');
  }, []);

  const handleSelectInstance = (instanceId: string) => {
    setActiveInstanceId(instanceId);
    navigate(`/instances/${instanceId}`);
  };

  const handleNewInstance = () => {
    setShowNewInstanceModal(true);
  };

  const handleCloseInstance = useCallback((e: React.MouseEvent, instance: Instance) => {
    e.stopPropagation(); // Prevent selecting the instance
    setConfirmInstance(instance);
  }, []);

  const performClose = useCallback(async (instanceId: string) => {
    try {
      await instancesApi.close(instanceId);
      removeInstance(instanceId);
      // Check current pathname to see if we're viewing the closed instance
      // Use window.location.pathname to get the current value at runtime (not stale closure)
      if (window.location.pathname === `/instances/${instanceId}`) {
        navigate('/instances');
      }
    } catch {
      // Error toast already shown by API layer
    }
  }, [navigate, removeInstance]);

  // Collapsed sidebar
  if (!leftSidebarOpen) {
    return (
      <aside className="w-12 bg-surface-800 border-r border-surface-600 flex flex-col items-center py-3 gap-2 flex-shrink-0">
        <Tooltip text="Expand sidebar (⌘B)" position="right">
          <button
            onClick={toggleLeftSidebar}
            className="p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
            aria-label="Expand sidebar"
          >
            <Icons.panelLeft />
          </button>
        </Tooltip>

        <div className="w-6 h-px bg-surface-600 my-1" />

        {/* Collapsed instance indicators */}
        {pinnedInstances.slice(0, 3).map((inst) => (
          <Tooltip key={inst.id} text={inst.name} position="right">
            <button
              onClick={() => handleSelectInstance(inst.id)}
              className={`p-2 rounded-lg transition-colors ${
                expandedId === inst.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/40'
                  : activeInstanceId === inst.id
                  ? 'bg-surface-700 text-accent'
                  : 'text-theme-muted hover:text-theme-primary hover:bg-surface-700'
              }`}
            >
              <StatusDot status={inst.status} size="md" />
            </button>
          </Tooltip>
        ))}

        {pinnedInstances.length > 3 && (
          <span className="text-xs text-theme-muted">+{pinnedInstances.length - 3}</span>
        )}

        <div className="flex-1" />

        <Tooltip text="New instance" position="right">
          <button
            onClick={handleNewInstance}
            className="p-2 rounded-lg text-theme-muted hover:text-accent hover:bg-surface-700 transition-colors"
            aria-label="Create new instance"
          >
            <Icons.plus />
          </button>
        </Tooltip>
      </aside>
    );
  }

  // Expanded sidebar
  return (
    <aside
      style={{ width: leftSidebarWidth }}
      className="bg-surface-800 border-r border-surface-600 flex flex-col flex-shrink-0 relative"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-600">
        <span className="text-xs font-medium text-theme-primary flex items-center gap-2">
          <Icons.instances />
          Sessions
        </span>
        <div className="flex items-center gap-1">
          <Tooltip text="New instance" position="bottom">
            <button
              onClick={handleNewInstance}
              className="p-1 rounded hover:bg-surface-700 text-theme-dim hover:text-accent transition-colors"
              aria-label="Create new instance"
            >
              <Icons.plus />
            </button>
          </Tooltip>
          <Tooltip text="Collapse sidebar (⌘B)" position="bottom">
            <button
              onClick={toggleLeftSidebar}
              className="p-1 rounded hover:bg-surface-700 text-theme-dim hover:text-theme-primary transition-colors"
              aria-label="Collapse sidebar"
            >
              <Icons.panelLeft />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Pinned section */}
      {pinnedInstances.length > 0 && (
        <div className="px-2 py-2 border-b border-surface-600">
          <div className="text-[10px] uppercase tracking-wider px-2 mb-2 flex items-center gap-1.5 text-theme-dim">
            <span className="text-accent">★</span> Pinned
          </div>
          {pinnedInstances.map((inst) => {
            const shortcutNum = getInstanceIndex(inst.id);
            return (
              <Tooltip key={inst.id} text={getWorkingDirDisplay(inst)} position="right">
                <div
                  onClick={() => handleSelectInstance(inst.id)}
                  className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors mb-0.5 cursor-pointer
                    ${expandedId === inst.id
                      ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                      : activeInstanceId === inst.id
                      ? 'bg-surface-700 text-theme-primary'
                      : 'text-theme-dim hover:bg-surface-700 hover:text-theme-primary'}`}
                >
                  {shortcutNum && (
                    <span className="w-4 h-4 rounded bg-surface-600 text-[10px] flex items-center justify-center text-theme-dim font-mono flex-shrink-0">
                      {shortcutNum}
                    </span>
                  )}
                  <StatusDot status={inst.status} size="sm" />
                  {inst.machineType === 'remote' && (
                    <span className="text-accent flex-shrink-0" title="Remote instance">
                      <Icons.wifi />
                    </span>
                  )}
                  <EditableName
                    name={inst.name}
                    isEditing={editingId === inst.id}
                    editingValue={editingName}
                    onStartEdit={() => handleStartEditing(inst)}
                    onValueChange={setEditingName}
                    onConfirm={handleConfirmRename}
                    onCancel={handleCancelEditing}
                    className="flex-1 truncate text-xs"
                  />
                  <button
                    onClick={(e) => handleCloseInstance(e, inst)}
                    className="hidden group-hover:block p-0.5 rounded hover:bg-surface-600 text-theme-dim hover:text-state-error transition-colors"
                    title="Close instance"
                  >
                    <Icons.close />
                  </button>
                </div>
              </Tooltip>
            );
          })}
        </div>
      )}

      {/* All instances section */}
      <div className="flex-1 overflow-auto px-2 py-2">
        <div className="text-[10px] uppercase tracking-wider px-2 mb-2 text-theme-dim">
          All Sessions
        </div>
        {unpinnedInstances.map((inst) => {
          const shortcutNum = getInstanceIndex(inst.id);
          return (
            <Tooltip key={inst.id} text={getWorkingDirDisplay(inst)} position="right">
              <div
                onClick={() => handleSelectInstance(inst.id)}
                className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors mb-0.5 cursor-pointer
                  ${expandedId === inst.id
                    ? 'bg-frost-4/30 text-frost-2 border border-frost-4/50'
                    : activeInstanceId === inst.id
                    ? 'bg-surface-700 text-theme-primary'
                    : 'text-theme-dim hover:bg-surface-700 hover:text-theme-primary'}`}
              >
                {shortcutNum && (
                  <span className="w-4 h-4 rounded bg-surface-600 text-[10px] flex items-center justify-center text-theme-dim font-mono flex-shrink-0">
                    {shortcutNum}
                  </span>
                )}
                <StatusDot status={inst.status} size="sm" />
                {inst.machineType === 'remote' && (
                  <span className="text-accent flex-shrink-0" title="Remote instance">
                    <Icons.wifi />
                  </span>
                )}
                <EditableName
                  name={inst.name}
                  isEditing={editingId === inst.id}
                  editingValue={editingName}
                  onStartEdit={() => handleStartEditing(inst)}
                  onValueChange={setEditingName}
                  onConfirm={handleConfirmRename}
                  onCancel={handleCancelEditing}
                  className="flex-1 truncate text-xs"
                />
                <button
                  onClick={(e) => handleCloseInstance(e, inst)}
                  className="hidden group-hover:block p-0.5 rounded hover:bg-surface-600 text-theme-dim hover:text-state-error transition-colors"
                  title="Close instance"
                >
                  <Icons.close />
                </button>
              </div>
            </Tooltip>
          );
        })}

        {unpinnedInstances.length === 0 && pinnedInstances.length === 0 && (
          <div className="text-center py-8 text-theme-muted text-sm">
            No sessions yet.
            <br />
            <button
              onClick={handleNewInstance}
              className="text-accent hover:underline mt-2 inline-block"
            >
              Create one
            </button>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-3 py-2 border-t border-surface-600 text-xs text-theme-muted">
        <div className="flex justify-between mb-1">
          <span>{instances.filter((i) => i.status === 'working').length} working</span>
          <span>{instances.filter((i) => i.status === 'idle').length} idle</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-surface-700">
          <span className="text-theme-dim">v{__APP_VERSION__}</span>
          <span className={`text-[9px] px-1 py-0.5 rounded uppercase tracking-wide
            ${isDevMode()
              ? 'bg-accent/15 text-accent'
              : 'bg-frost-4/15 text-frost-3'
            }`}>
            {getDisplayLabel()}
          </span>
        </div>
      </div>

      {/* Confirm Close Dialog */}
      {confirmInstance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card-elevated rounded-xl p-6 max-w-md shadow-2xl bg-surface-700">
            <h3 className="text-lg font-semibold mb-2 text-theme-primary">Close Instance</h3>
            <p className="text-theme-muted mb-6">
              {confirmInstance.status === 'working'
                ? `"${confirmInstance.name}" is currently working. Are you sure you want to close it?`
                : confirmInstance.isPinned
                ? `"${confirmInstance.name}" is pinned. Are you sure you want to close it?`
                : `Are you sure you want to close "${confirmInstance.name}"?`}
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

      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent transition-colors"
        onMouseDown={handleResizeStart}
      />
    </aside>
  );
}
