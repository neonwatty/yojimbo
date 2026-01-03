import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { Toast as ToastType, ToastType as ToastVariant } from '../../store/toastStore';
import { useToastStore } from '../../store/toastStore';

const icons: Record<ToastVariant, JSX.Element> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const colorClasses: Record<ToastVariant, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-surface-700',
    border: 'border-state-working',
    icon: 'text-state-working',
  },
  error: {
    bg: 'bg-surface-700',
    border: 'border-state-error',
    icon: 'text-state-error',
  },
  warning: {
    bg: 'bg-surface-700',
    border: 'border-state-awaiting',
    icon: 'text-state-awaiting',
  },
  info: {
    bg: 'bg-surface-700',
    border: 'border-frost-2',
    icon: 'text-frost-2',
  },
};

interface ToastProps {
  toast: ToastType;
}

export function Toast({ toast }: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const removeToast = useToastStore((state) => state.removeToast);
  const colors = colorClasses[toast.type];

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      removeToast(toast.id);
    }, 200);
  };

  // Start exit animation before auto-dismiss
  useEffect(() => {
    if (toast.duration > 0) {
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, toast.duration - 200);

      return () => clearTimeout(exitTimer);
    }
  }, [toast.duration]);

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm
        shadow-lg min-w-[280px] max-w-[400px]
        ${colors.bg} ${colors.border}
        ${isExiting ? 'animate-toast-out' : 'animate-toast-in'}
      `}
      role="alert"
    >
      <span className={`flex-shrink-0 mt-0.5 ${colors.icon}`}>
        {icons[toast.type]}
      </span>
      <p className="flex-1 text-xs text-theme-primary leading-relaxed font-mono">
        {toast.message}
      </p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-0.5 -mr-1 -mt-0.5 rounded hover:bg-surface-600/50 transition-colors text-theme-dim hover:text-theme-primary"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Mobile: top position, Desktop: bottom-right */}
      <div className="fixed top-4 left-4 right-4 z-[100] flex flex-col gap-2 items-center md:hidden">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </div>
      <div className="fixed bottom-4 right-4 z-[100] flex-col gap-2 hidden md:flex">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} />
        ))}
      </div>
    </>
  );
}
