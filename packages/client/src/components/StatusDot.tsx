import type { InstanceStatus } from '@cc-orchestrator/shared';

interface StatusDotProps {
  status: InstanceStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

const statusColors: Record<InstanceStatus, string> = {
  working: 'bg-state-working',
  awaiting: 'bg-state-awaiting',
  idle: 'bg-state-idle',
  error: 'bg-state-error',
};

export function StatusDot({ status, size = 'md', className = '' }: StatusDotProps) {
  const isAnimated = status === 'working';

  return (
    <span
      className={`
        inline-block rounded-full flex-shrink-0
        ${sizeClasses[size]}
        ${statusColors[status]}
        ${isAnimated ? 'animate-pulse-glow' : ''}
        ${className}
      `}
      title={status}
    />
  );
}
