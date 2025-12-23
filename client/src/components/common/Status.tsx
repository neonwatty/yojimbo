import type { InstanceStatus } from '@cc-orchestrator/shared';

interface StatusDotProps {
  status: InstanceStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusDot({ status, size = 'md' }: StatusDotProps) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const colorClasses = {
    working: 'bg-state-working pulse-working',
    awaiting: 'bg-state-awaiting',
    idle: 'bg-state-idle',
    error: 'bg-state-error',
    disconnected: 'bg-gray-500',
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
    disconnected: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${bgClasses[status]}`}
    >
      <StatusDot status={status} size="sm" />
      {labels[status]}
    </span>
  );
}
