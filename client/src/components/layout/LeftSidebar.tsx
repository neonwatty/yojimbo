import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInstancesStore } from '../../store/instancesStore';
import { useUIStore } from '../../store/uiStore';
import { StatusDot } from '../common/Status';
import Tooltip from '../common/Tooltip';
import { Icons } from '../common/Icons';
import { instancesApi } from '../../api/client';
import type { Instance } from '@cc-orchestrator/shared';

export function LeftSidebar() {
  const navigate = useNavigate();
  const { id: expandedId } = useParams();
  const { instances, activeInstanceId, setActiveInstanceId, removeInstance } = useInstancesStore();
  const { leftSidebarOpen, toggleLeftSidebar } = useUIStore();

  const pinnedInstances = instances.filter((i) => i.isPinned);
  const unpinnedInstances = instances.filter((i) => !i.isPinned);

  // Confirmation dialog state
  const [confirmInstance, setConfirmInstance] = useState<Instance | null>(null);

  const handleSelectInstance = (instanceId: string) => {
    setActiveInstanceId(instanceId);
    navigate(`/instances/${instanceId}`);
  };

  const handleNewInstance = () => {
    navigate('/instances');
    // The new instance action will be handled by the instances page
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
    } catch (error) {
      console.error('Failed to close instance:', error);
    }
  }, [navigate, removeInstance]);

  // Collapsed sidebar
  if (!leftSidebarOpen) {
    return (
      <div className="w-12 bg-surface-800 border-r border-surface-600 flex flex-col items-center py-3 gap-2 flex-shrink-0">
        <Tooltip text="Expand sidebar (⌘B)" position="right">
          <button
            onClick={toggleLeftSidebar}
            className="p-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
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
                  ? 'bg-accent/20 text-accent ring-1 ring-accent'
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
          >
            <Icons.plus />
          </button>
        </Tooltip>
      </div>
    );
  }

  // Expanded sidebar
  return (
    <div className="w-56 bg-surface-800 border-r border-surface-600 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-surface-600">
        <span className="text-sm font-semibold text-theme-primary flex items-center gap-2">
          <Icons.instances />
          Sessions
        </span>
        <div className="flex items-center gap-1">
          <Tooltip text="New instance" position="bottom">
            <button
              onClick={handleNewInstance}
              className="p-1.5 rounded hover:bg-surface-700 text-theme-muted hover:text-accent transition-colors"
            >
              <Icons.plus />
            </button>
          </Tooltip>
          <Tooltip text="Collapse sidebar (⌘B)" position="bottom">
            <button
              onClick={toggleLeftSidebar}
              className="p-1.5 rounded hover:bg-surface-700 text-theme-muted hover:text-theme-primary transition-colors"
            >
              <Icons.panelLeft />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Pinned section */}
      {pinnedInstances.length > 0 && (
        <div className="px-2 py-2">
          <div className="text-xs font-medium text-theme-muted uppercase tracking-wider px-2 mb-2 flex items-center gap-1">
            <span className="text-accent">★</span> Pinned
          </div>
          {pinnedInstances.map((inst) => (
            <div
              key={inst.id}
              onClick={() => handleSelectInstance(inst.id)}
              className={`group w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors mb-1 cursor-pointer
                ${expandedId === inst.id
                  ? 'bg-accent/20 text-theme-primary ring-1 ring-accent'
                  : activeInstanceId === inst.id
                  ? 'bg-surface-700 text-theme-primary'
                  : 'text-theme-secondary hover:bg-surface-700'}`}
            >
              <StatusDot status={inst.status} size="sm" />
              <span className="flex-1 truncate text-sm">{inst.name}</span>
              {inst.status === 'awaiting' && (
                <span className="w-2 h-2 rounded-full bg-state-awaiting animate-pulse group-hover:hidden" />
              )}
              <button
                onClick={(e) => handleCloseInstance(e, inst)}
                className="hidden group-hover:block p-0.5 rounded hover:bg-surface-600 text-theme-muted hover:text-red-400 transition-colors"
                title="Close instance"
              >
                <Icons.close />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* All instances section */}
      <div className="flex-1 overflow-auto px-2 py-2">
        <div className="text-xs font-medium text-theme-muted uppercase tracking-wider px-2 mb-2">
          All Sessions
        </div>
        {unpinnedInstances.map((inst) => (
          <div
            key={inst.id}
            onClick={() => handleSelectInstance(inst.id)}
            className={`group w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors mb-1 cursor-pointer
              ${expandedId === inst.id
                ? 'bg-accent/20 text-theme-primary ring-1 ring-accent'
                : activeInstanceId === inst.id
                ? 'bg-surface-700 text-theme-primary'
                : 'text-theme-secondary hover:bg-surface-700'}`}
          >
            <StatusDot status={inst.status} size="sm" />
            <span className="flex-1 truncate text-sm">{inst.name}</span>
            {inst.status === 'awaiting' && (
              <span className="w-2 h-2 rounded-full bg-state-awaiting animate-pulse group-hover:hidden" />
            )}
            <button
              onClick={(e) => handleCloseInstance(e, inst)}
              className="hidden group-hover:block p-0.5 rounded hover:bg-surface-600 text-theme-muted hover:text-red-400 transition-colors"
              title="Close instance"
            >
              <Icons.close />
            </button>
          </div>
        ))}

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
        <div className="flex justify-between">
          <span>{instances.filter((i) => i.status === 'working').length} working</span>
          <span>{instances.filter((i) => i.status === 'awaiting').length} awaiting</span>
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
                : confirmInstance.status === 'awaiting'
                ? `"${confirmInstance.name}" is awaiting input. Are you sure you want to close it?`
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
    </div>
  );
}
