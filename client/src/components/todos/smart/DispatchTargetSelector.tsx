import { useState, useRef, useEffect } from 'react';
import { Icons } from '../../common/Icons';
import type { ParsedTodo, DispatchTarget, ProjectInstanceInfo } from '@cc-orchestrator/shared';

interface DispatchTargetSelectorProps {
  todo: ParsedTodo;
  projectId: string | null;
  availableInstances: ProjectInstanceInfo[];
  currentTarget: DispatchTarget | undefined;
  onSelect: (target: DispatchTarget) => void;
  projectName?: string;
  projectPath?: string;
}

export function DispatchTargetSelector({
  todo: _todo,
  projectId,
  availableInstances,
  currentTarget,
  onSelect,
  projectName,
  projectPath,
}: DispatchTargetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Group instances by status
  const idleInstances = availableInstances.filter((i) => i.status === 'idle');
  const busyInstances = availableInstances.filter((i) => i.status === 'working');

  // Get display text for current selection
  const getDisplayText = (): { text: string; status: 'idle' | 'working' | 'new' | 'none' } => {
    if (!currentTarget || currentTarget.type === 'none') {
      return { text: 'Don\'t dispatch', status: 'none' };
    }

    if (currentTarget.type === 'new-instance') {
      return { text: '+ New instance', status: 'new' };
    }

    if (currentTarget.type === 'instance' && currentTarget.instanceId) {
      const instance = availableInstances.find((i) => i.id === currentTarget.instanceId);
      if (instance) {
        return {
          text: instance.name,
          status: instance.status === 'working' ? 'working' : 'idle',
        };
      }
    }

    return { text: 'Select target', status: 'none' };
  };

  const { text: displayText, status: displayStatus } = getDisplayText();

  // If no project is assigned, show disabled state
  if (!projectId) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-700/50 border border-surface-600/50 rounded text-xs text-theme-muted opacity-60 cursor-not-allowed">
        <span className="text-theme-muted text-[10px]">Dispatch:</span>
        <span>No project</span>
      </div>
    );
  }

  const handleSelect = (target: DispatchTarget) => {
    onSelect(target);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-colors border ${
          isOpen
            ? 'bg-frost-400/20 border-frost-300'
            : 'bg-gradient-to-r from-frost-400/20 to-frost-200/10 border-frost-300/50 hover:border-frost-300'
        }`}
      >
        <span className="text-theme-muted text-[10px]">Dispatch:</span>
        <StatusDot status={displayStatus} />
        <span className={displayStatus === 'new' ? 'text-accent' : 'text-theme-secondary'}>
          {displayText}
        </span>
        {displayStatus === 'working' && (
          <span className="text-[9px] text-theme-muted">(queue)</span>
        )}
        <span className={`text-theme-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <Icons.chevronDown />
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[220px] bg-surface-700 border border-surface-600 rounded-lg shadow-lg py-1">
          {/* Idle Instances Section */}
          {idleInstances.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] text-theme-muted uppercase tracking-wider">
                Idle Instances (recommended)
              </div>
              {idleInstances.map((instance) => (
                <button
                  key={instance.id}
                  onClick={() => handleSelect({ type: 'instance', instanceId: instance.id })}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-600 transition-colors ${
                    currentTarget?.instanceId === instance.id ? 'bg-frost-200/10' : ''
                  }`}
                >
                  <StatusDot status="idle" />
                  <span className="flex-1 text-theme-secondary">{instance.name}</span>
                  <span className="text-[10px] text-state-idle">● idle</span>
                </button>
              ))}
            </>
          )}

          {/* Busy Instances Section */}
          {busyInstances.length > 0 && (
            <>
              {idleInstances.length > 0 && <div className="h-px bg-surface-600 my-1" />}
              <div className="px-3 py-1.5 text-[10px] text-theme-muted uppercase tracking-wider">
                Busy Instances (will queue)
              </div>
              {busyInstances.map((instance) => (
                <button
                  key={instance.id}
                  onClick={() => handleSelect({ type: 'instance', instanceId: instance.id })}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-600 transition-colors ${
                    currentTarget?.instanceId === instance.id ? 'bg-frost-200/10' : ''
                  }`}
                >
                  <StatusDot status="working" />
                  <span className="flex-1 text-theme-secondary">{instance.name}</span>
                  <span className="text-[10px] text-state-working">● working</span>
                </button>
              ))}
            </>
          )}

          {/* Divider before other options */}
          {(idleInstances.length > 0 || busyInstances.length > 0) && (
            <div className="h-px bg-surface-600 my-1" />
          )}

          {/* Other Options Section */}
          <div className="px-3 py-1.5 text-[10px] text-theme-muted uppercase tracking-wider">
            Other Options
          </div>

          {/* Create new instance */}
          <button
            onClick={() =>
              handleSelect({
                type: 'new-instance',
                newInstanceName: `${projectName || 'project'}-task`,
                workingDir: projectPath,
              })
            }
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-600 transition-colors ${
              currentTarget?.type === 'new-instance' ? 'bg-frost-200/10' : ''
            }`}
          >
            <StatusDot status="new" />
            <span className="text-accent">Create new instance</span>
          </button>

          {/* Don't dispatch */}
          <button
            onClick={() => handleSelect({ type: 'none' })}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-600 transition-colors ${
              currentTarget?.type === 'none' ? 'bg-frost-200/10' : ''
            }`}
          >
            <div className="w-1.5 h-1.5" /> {/* Spacer for alignment */}
            <span className="text-theme-muted">Don't dispatch (save only)</span>
          </button>
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: 'idle' | 'working' | 'new' | 'none' }) {
  if (status === 'none') {
    return <div className="w-1.5 h-1.5" />;
  }

  const colors = {
    idle: 'bg-state-idle',
    working: 'bg-state-working',
    new: 'bg-accent',
  };

  return <div className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />;
}
