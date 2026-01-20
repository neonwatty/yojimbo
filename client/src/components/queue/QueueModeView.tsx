import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueueMode } from '../../hooks/useQueueMode';
import { useInstancesStore } from '../../store/instancesStore';
import { useUIStore } from '../../store/uiStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getWsUrl } from '../../config';
import { QueueCard } from './QueueCard';
import { QueueProgress } from './QueueProgress';
import { Icons } from '../common/Icons';

export function QueueModeView() {
  const navigate = useNavigate();
  const {
    currentInstance,
    currentIndex,
    totalCount,
    isEmpty,
    skip,
    reset,
  } = useQueueMode();

  const setCurrentView = useUIStore((state) => state.setCurrentView);
  const setExpandedInstanceId = useInstancesStore((state) => state.setExpandedInstanceId);

  const { send } = useWebSocket(getWsUrl());

  const handleExit = useCallback(() => {
    setCurrentView('instances');
    navigate('/instances');
  }, [setCurrentView, navigate]);

  const handleSendCommand = useCallback(
    (command: string) => {
      if (!currentInstance) return;

      // Send command via terminal input
      send('terminal:input', {
        instanceId: currentInstance.id,
        data: command + '\n',
      });

      // Move to next instance after sending
      skip();
    },
    [currentInstance, send, skip]
  );

  const handleExpand = useCallback(() => {
    if (!currentInstance) return;
    setExpandedInstanceId(currentInstance.id);
    navigate(`/instances/${currentInstance.id}`);
  }, [currentInstance, setExpandedInstanceId, navigate]);

  // Empty state
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

  // Completed state (all skipped or processed)
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
              onClick={reset}
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-600">
        <div className="flex items-center gap-3">
          <button
            onClick={handleExit}
            className="p-1.5 rounded hover:bg-surface-600 transition-colors text-theme-dim hover:text-theme-primary"
            title="Exit queue mode"
          >
            <Icons.close />
          </button>
          <h1 className="text-sm font-medium text-theme-primary">
            Review Idle Instances
          </h1>
        </div>
        <QueueProgress current={currentIndex} total={totalCount} />
      </div>

      {/* Card Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {currentInstance && (
          <QueueCard
            instance={currentInstance}
            onSendCommand={handleSendCommand}
            onSkip={skip}
            onExpand={handleExpand}
          />
        )}
      </div>

      {/* Footer hints */}
      <div className="p-4 border-t border-surface-600">
        <div className="flex justify-center gap-6 text-[10px] text-theme-dim">
          <span>
            <kbd className="px-1.5 py-0.5 bg-surface-600 rounded text-[9px]">←</kbd> Skip
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-surface-600 rounded text-[9px]">Enter</kbd> Send command
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-surface-600 rounded text-[9px]">→</kbd> Open terminal
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-surface-600 rounded text-[9px]">Esc</kbd> Exit
          </span>
        </div>
      </div>
    </div>
  );
}
