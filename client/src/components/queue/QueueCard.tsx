import type { Instance } from '@cc-orchestrator/shared';
import { StatusDot, StatusBadge } from '../common/Status';
import { Icons } from '../common/Icons';
import { formatRelativeTime } from '../../utils/strings';
import { QueueCommandInput } from './QueueCommandInput';

interface QueueCardProps {
  instance: Instance;
  onSendCommand: (command: string) => void;
  onSkip: () => void;
  onExpand: () => void;
  isAnimating?: boolean;
}

export function QueueCard({
  instance,
  onSendCommand,
  onSkip,
  onExpand,
  isAnimating = false,
}: QueueCardProps) {
  return (
    <div
      className={`
        bg-surface-700 rounded-xl border border-surface-600 p-4 w-full max-w-md mx-auto
        shadow-lg transition-all duration-200
        ${isAnimating ? 'opacity-50 scale-95' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={instance.status} size="md" />
          <h3 className="font-medium text-theme-primary truncate max-w-[200px]">
            {instance.name}
          </h3>
        </div>
        <StatusBadge status={instance.status} />
      </div>

      {/* Working Directory */}
      <div className="mb-3">
        <div className="text-[10px] text-theme-dim uppercase tracking-wide mb-1">
          Working Directory
        </div>
        <div className="text-xs font-mono text-theme-secondary truncate">
          {instance.workingDir}
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex gap-4 mb-4 text-[10px] text-theme-dim">
        <div>
          <span className="opacity-70">Created:</span>{' '}
          {formatRelativeTime(instance.createdAt)}
        </div>
        {instance.updatedAt !== instance.createdAt && (
          <div>
            <span className="opacity-70">Active:</span>{' '}
            {formatRelativeTime(instance.updatedAt)}
          </div>
        )}
      </div>

      {/* Machine indicator */}
      {instance.machineType === 'remote' && (
        <div className="mb-4">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-aurora-purple/20 text-aurora-purple text-[10px] rounded">
            Remote
          </span>
        </div>
      )}

      {/* Terminal Preview Placeholder */}
      <div className="bg-surface-900 rounded-lg p-3 mb-4 min-h-[80px] flex items-center justify-center">
        <div className="text-theme-dim text-xs font-mono opacity-50">
          Waiting for input...
        </div>
      </div>

      {/* Command Input */}
      <div className="mb-4">
        <QueueCommandInput
          onSubmit={onSendCommand}
          placeholder="Enter command to run..."
          disabled={isAnimating}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          disabled={isAnimating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-theme-dim hover:text-theme-primary transition-colors disabled:opacity-50"
        >
          <Icons.chevronLeft />
          Skip
        </button>

        <button
          onClick={onExpand}
          disabled={isAnimating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-600 hover:bg-surface-500 text-theme-primary rounded-lg transition-colors disabled:opacity-50"
        >
          Open Terminal
          <Icons.expand />
        </button>
      </div>
    </div>
  );
}
