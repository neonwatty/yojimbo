import { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstancesStore } from '../../store/instancesStore';
import { useUIStore } from '../../store/uiStore';
import { Icons } from '../common/Icons';
import type { Instance } from '@cc-orchestrator/shared';

interface MobileHomeViewProps {
  onTopGesture: () => void;
  onBottomGesture: () => void;
  onViewAllInstances?: () => void;
}

export function MobileHomeView({ onTopGesture, onBottomGesture, onViewAllInstances }: MobileHomeViewProps) {
  const navigate = useNavigate();
  const instances = useInstancesStore((state) => state.instances);
  const setActiveInstanceId = useInstancesStore((state) => state.setActiveInstanceId);
  const setShowNewInstanceModal = useUIStore((state) => state.setShowNewInstanceModal);

  const touchRef = useRef({ startY: 0, zone: null as string | null });

  // Gesture handling for edge swipes
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = touch.clientY - rect.top;
    const height = rect.height;

    let zone: string | null = null;
    if (relativeY < 80) zone = 'top';
    else if (relativeY > height - 80) zone = 'bottom';

    touchRef.current = { startY: touch.clientY, zone };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const { startY, zone } = touchRef.current;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaY) > 50) {
      if (zone === 'top' && deltaY > 0 && onTopGesture) {
        onTopGesture();
      } else if (zone === 'bottom' && deltaY < 0 && onBottomGesture) {
        onBottomGesture();
      }
    }
  }, [onTopGesture, onBottomGesture]);

  // Compute stats
  const stats = [
    {
      label: 'Total',
      value: instances.length,
      colorClass: 'text-accent border-accent/30 bg-accent/10'
    },
    {
      label: 'Working',
      value: instances.filter((i) => i.status === 'working').length,
      colorClass: 'text-state-working border-state-working/30 bg-state-working/10'
    },
    {
      label: 'Awaiting',
      value: instances.filter((i) => i.status === 'awaiting').length,
      colorClass: 'text-state-awaiting border-state-awaiting/30 bg-state-awaiting/10'
    },
    {
      label: 'Errors',
      value: instances.filter((i) => i.status === 'error').length,
      colorClass: 'text-state-error border-state-error/30 bg-state-error/10'
    },
  ];

  const pinnedInstances = instances.filter((i) => i.isPinned).slice(0, 3);
  const recentInstances = instances.filter((i) => !i.isPinned).slice(0, 3);

  const handleNewInstance = () => {
    setShowNewInstanceModal(true);
  };

  const handleSelectInstance = (instance: Instance) => {
    setActiveInstanceId(instance.id);
    navigate(`/instances/${instance.id}`);
  };

  const handleViewAllInstances = () => {
    // Open the instance drawer instead of navigating to a separate page
    if (onViewAllInstances) {
      onViewAllInstances();
    } else {
      onBottomGesture();
    }
  };

  return (
    <div
      className="flex-1 flex flex-col bg-surface-800 overflow-auto"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Visual hint indicators */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>

      <div className="flex-1 px-4 pb-4 overflow-auto mobile-scroll">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-theme-primary">Dashboard</h1>
          <p className="text-xs text-theme-dim mt-0.5">Claude Code Orchestrator</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-xl p-3 border ${stat.colorClass}`}
            >
              <div className={`text-2xl font-bold ${stat.colorClass.split(' ')[0]}`}>
                {stat.value}
              </div>
              <div className="text-[10px] text-theme-dim mt-0.5 uppercase tracking-wider">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleNewInstance}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent text-surface-900 rounded-xl font-medium active:scale-[0.98] transition-transform"
          >
            <Icons.plus />
            New Session
          </button>
          <button
            onClick={handleViewAllInstances}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-surface-700 text-theme-primary rounded-xl font-medium active:scale-[0.98] transition-transform"
          >
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Pinned Instances */}
        {pinnedInstances.length > 0 && (
          <div className="mb-4">
            <h3 className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-theme-dim mb-2">
              <span className="text-accent">
                {Icons.star(true)}
              </span>
              Pinned
            </h3>
            <div className="bg-surface-700 rounded-xl overflow-hidden divide-y divide-surface-600">
              {pinnedInstances.map((instance) => (
                <button
                  key={instance.id}
                  onClick={() => handleSelectInstance(instance)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-surface-600 transition-colors"
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      instance.status === 'working' ? 'bg-state-working' :
                      instance.status === 'awaiting' ? 'bg-state-awaiting' :
                      instance.status === 'error' ? 'bg-state-error' :
                      'bg-state-idle'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-theme-primary block truncate">
                      {instance.name}
                    </span>
                    <span className="text-[10px] text-theme-dim block truncate">
                      {instance.workingDir.split('/').pop()}
                    </span>
                  </div>
                  {instance.machineType === 'remote' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent flex-shrink-0">
                      Remote
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Instances */}
        {recentInstances.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[10px] uppercase tracking-wider text-theme-dim mb-2">
              Recent
            </h3>
            <div className="bg-surface-700 rounded-xl overflow-hidden divide-y divide-surface-600">
              {recentInstances.map((instance) => (
                <button
                  key={instance.id}
                  onClick={() => handleSelectInstance(instance)}
                  className="w-full flex items-center gap-3 px-3 py-3 text-left active:bg-surface-600 transition-colors"
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      instance.status === 'working' ? 'bg-state-working' :
                      instance.status === 'awaiting' ? 'bg-state-awaiting' :
                      instance.status === 'error' ? 'bg-state-error' :
                      'bg-state-idle'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-theme-primary block truncate">
                      {instance.name}
                    </span>
                    <span className="text-[10px] text-theme-dim block truncate">
                      {instance.workingDir.split('/').pop()}
                    </span>
                  </div>
                  {instance.machineType === 'remote' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent flex-shrink-0">
                      Remote
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {instances.length === 0 && (
          <div className="text-center py-8">
            <div className="text-theme-dim mb-3">
              <Icons.terminal />
            </div>
            <h3 className="text-sm font-medium text-theme-primary mb-1">No sessions yet</h3>
            <p className="text-xs text-theme-dim mb-4">Create your first Claude Code session.</p>
            <button
              onClick={handleNewInstance}
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-surface-900 rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              <Icons.plus />
              New Session
            </button>
          </div>
        )}
      </div>

      {/* Bottom gesture hint */}
      <div className="flex justify-center pb-2">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>
    </div>
  );
}

export default MobileHomeView;
