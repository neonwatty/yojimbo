import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueueMode } from '../../hooks/useQueueMode';
import { useUIStore } from '../../store/uiStore';
import { Icons } from '../common/Icons';

/**
 * QueueModeView - Entry point for Queue Mode
 *
 * This component handles entering queue mode and redirecting to the first idle instance.
 * The actual queue navigation happens via QueueModeOverlay on the InstancesPage.
 */
export function QueueModeView() {
  const navigate = useNavigate();
  const {
    currentInstance,
    totalCount,
    isEmpty,
    reset,
  } = useQueueMode();

  const setCurrentView = useUIStore((state) => state.setCurrentView);
  const setQueueModeActive = useUIStore((state) => state.setQueueModeActive);

  const handleExit = useCallback(() => {
    setQueueModeActive(false);
    setCurrentView('instances');
    navigate('/instances');
  }, [setCurrentView, setQueueModeActive, navigate]);

  const handleStartOver = useCallback(() => {
    reset();
  }, [reset]);

  // When we have an instance to show, activate queue mode and navigate to it
  useEffect(() => {
    if (currentInstance) {
      setQueueModeActive(true);
      navigate(`/instances/${currentInstance.id}`);
    }
  }, [currentInstance, setQueueModeActive, navigate]);

  // Empty state - no idle instances
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
            <Icons.check className="w-8 h-8 text-state-working" />
          </div>
          <h2 className="text-lg font-medium text-theme-primary mb-2">
            All caught up!
          </h2>
          <p className="text-sm text-theme-dim mb-6">
            No idle instances need attention right now. All your Claude Code instances are either working or have been reviewed.
          </p>
          <button
            onClick={handleExit}
            className="px-4 py-2 bg-frost-4 text-white rounded-lg hover:bg-frost-3 transition-colors"
          >
            Back to Instances
          </button>
        </div>
      </div>
    );
  }

  // Completed state - all instances have been skipped
  if (!currentInstance && totalCount > 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-700 flex items-center justify-center">
            <Icons.check className="w-8 h-8 text-state-working" />
          </div>
          <h2 className="text-lg font-medium text-theme-primary mb-2">
            Queue complete!
          </h2>
          <p className="text-sm text-theme-dim mb-6">
            You've reviewed all {totalCount} idle instances.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleStartOver}
              className="px-4 py-2 bg-surface-600 text-theme-primary rounded-lg hover:bg-surface-500 transition-colors"
            >
              Start Over
            </button>
            <button
              onClick={handleExit}
              className="px-4 py-2 bg-frost-4 text-white rounded-lg hover:bg-frost-3 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading/redirecting state - brief moment before navigation
  return (
    <div className="flex flex-col items-center justify-center h-full p-6">
      <div className="text-center">
        <div className="w-8 h-8 mx-auto mb-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-theme-dim">Loading queue...</p>
      </div>
    </div>
  );
}
