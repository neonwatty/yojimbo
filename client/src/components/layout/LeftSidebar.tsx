import { useNavigate, useParams } from 'react-router-dom';
import { useInstancesStore } from '../../store/instancesStore';
import { useUIStore } from '../../store/uiStore';
import { StatusDot } from '../common/Status';
import Tooltip from '../common/Tooltip';
import { Icons } from '../common/Icons';

export function LeftSidebar() {
  const navigate = useNavigate();
  const { id: expandedId } = useParams();
  const { instances, activeInstanceId, setActiveInstanceId } = useInstancesStore();
  const { leftSidebarOpen, toggleLeftSidebar } = useUIStore();

  const pinnedInstances = instances.filter((i) => i.isPinned);
  const unpinnedInstances = instances.filter((i) => !i.isPinned);

  const handleSelectInstance = (instanceId: string) => {
    setActiveInstanceId(instanceId);
    navigate(`/instances/${instanceId}`);
  };

  const handleNewInstance = () => {
    navigate('/instances');
    // The new instance action will be handled by the instances page
  };

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
            <button
              key={inst.id}
              onClick={() => handleSelectInstance(inst.id)}
              className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors mb-1
                ${expandedId === inst.id
                  ? 'bg-accent/20 text-theme-primary ring-1 ring-accent'
                  : activeInstanceId === inst.id
                  ? 'bg-surface-700 text-theme-primary'
                  : 'text-theme-secondary hover:bg-surface-700'}`}
            >
              <StatusDot status={inst.status} size="sm" />
              <span className="flex-1 truncate text-sm">{inst.name}</span>
              {inst.status === 'awaiting' && (
                <span className="w-2 h-2 rounded-full bg-state-awaiting animate-pulse" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* All instances section */}
      <div className="flex-1 overflow-auto px-2 py-2">
        <div className="text-xs font-medium text-theme-muted uppercase tracking-wider px-2 mb-2">
          All Sessions
        </div>
        {unpinnedInstances.map((inst) => (
          <button
            key={inst.id}
            onClick={() => handleSelectInstance(inst.id)}
            className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors mb-1
              ${expandedId === inst.id
                ? 'bg-accent/20 text-theme-primary ring-1 ring-accent'
                : activeInstanceId === inst.id
                ? 'bg-surface-700 text-theme-primary'
                : 'text-theme-secondary hover:bg-surface-700'}`}
          >
            <StatusDot status={inst.status} size="sm" />
            <span className="flex-1 truncate text-sm">{inst.name}</span>
            {inst.status === 'awaiting' && (
              <span className="w-2 h-2 rounded-full bg-state-awaiting animate-pulse" />
            )}
          </button>
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
    </div>
  );
}
