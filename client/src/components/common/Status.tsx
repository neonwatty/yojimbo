import type { InstanceStatus } from '@cc-orchestrator/shared';

interface StatusDotProps {
  status: InstanceStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusDot({ status, size = 'md' }: StatusDotProps) {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  const colorClasses = {
    working: 'bg-state-working pulse-working',
    awaiting: 'bg-state-awaiting',
    idle: 'bg-state-idle',
    error: 'bg-state-error',
    disconnected: 'bg-surface-500',
  };

  return <span className={`inline-block rounded-full ${sizeClasses[size]} ${colorClasses[status]}`} />;
}

interface StatusBadgeProps {
  status: InstanceStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const labels: Record<InstanceStatus, string> = {
    working: 'Working',
    awaiting: 'Awaiting',
    idle: 'Idle',
    error: 'Error',
    disconnected: 'Disconnected',
  };

  const bgClasses: Record<InstanceStatus, string> = {
    working: 'bg-state-working/20 text-state-working border-state-working/30',
    awaiting: 'bg-state-awaiting/20 text-state-awaiting border-state-awaiting/30',
    idle: 'bg-state-idle/20 text-state-idle border-state-idle/30',
    error: 'bg-state-error/20 text-state-error border-state-error/30',
    disconnected: 'bg-surface-500/20 text-surface-500 border-surface-500/30',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${bgClasses[status]}`}
    >
      <StatusDot status={status} size="sm" />
      {labels[status]}
    </span>
  );
}
