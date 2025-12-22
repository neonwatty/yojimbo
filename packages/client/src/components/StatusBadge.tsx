import type { ReactNode } from 'react';
import type { InstanceStatus } from '@cc-orchestrator/shared';

interface StatusBadgeProps {
  status: InstanceStatus;
  showIcon?: boolean;
  className?: string;
}

const statusConfig: Record<
  InstanceStatus,
  { label: string; bgClass: string; textClass: string; borderClass: string; icon: ReactNode }
> = {
  working: {
    label: 'Working',
    bgClass: 'bg-state-working/10',
    textClass: 'text-state-working',
    borderClass: 'border-state-working/30',
    icon: (
      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    ),
  },
  awaiting: {
    label: 'Awaiting',
    bgClass: 'bg-state-awaiting/10',
    textClass: 'text-state-awaiting',
    borderClass: 'border-state-awaiting/30',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  idle: {
    label: 'Idle',
    bgClass: 'bg-state-idle/10',
    textClass: 'text-state-idle',
    borderClass: 'border-state-idle/30',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    label: 'Error',
    bgClass: 'bg-state-error/10',
    textClass: 'text-state-error',
    borderClass: 'border-state-error/30',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
};

export function StatusBadge({ status, showIcon = true, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
        border ${config.bgClass} ${config.textClass} ${config.borderClass}
        ${className}
      `}
    >
      {showIcon && config.icon}
      {config.label}
    </span>
  );
}
