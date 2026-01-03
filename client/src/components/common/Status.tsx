import type { InstanceStatus } from '@cc-orchestrator/shared';
import Tooltip from './Tooltip';

const statusDescriptions: Record<InstanceStatus, string> = {
  working: 'Claude is actively processing',
  idle: 'Ready for input',
  error: 'An error occurred - check terminal',
  disconnected: 'Connection lost - attempting to reconnect',
};

interface StatusDotProps {
  status: InstanceStatus;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function StatusDot({ status, size = 'md', showTooltip = false }: StatusDotProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  const colorClasses = {
    working: 'bg-state-working pulse-working',
    idle: 'bg-state-idle',
    error: 'bg-state-error',
    disconnected: 'bg-state-awaiting',
  };

  const dot = <span className={`inline-block rounded-full ${sizeClasses[size]} ${colorClasses[status]}`} />;

  if (showTooltip) {
    return (
      <Tooltip text={statusDescriptions[status]} position="bottom">
        {dot}
      </Tooltip>
    );
  }

  return dot;
}

interface StatusBadgeProps {
  status: InstanceStatus;
  showTooltip?: boolean;
}

export function StatusBadge({ status, showTooltip = false }: StatusBadgeProps) {
  const labels: Record<InstanceStatus, string> = {
    working: 'Working',
    idle: 'Idle',
    error: 'Error',
    disconnected: 'Disconnected',
  };

  const bgClasses: Record<InstanceStatus, string> = {
    working: 'bg-state-working/20 text-state-working border-state-working/30',
    idle: 'bg-state-idle/20 text-state-idle border-state-idle/30',
    error: 'bg-state-error/20 text-state-error border-state-error/30',
    disconnected: 'bg-state-awaiting/20 text-state-awaiting border-state-awaiting/30',
  };

  const badge = (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${bgClasses[status]}`}
    >
      <StatusDot status={status} size="sm" />
      {labels[status]}
    </span>
  );

  if (showTooltip) {
    return (
      <Tooltip text={statusDescriptions[status]} position="bottom">
        {badge}
      </Tooltip>
    );
  }

  return badge;
}
