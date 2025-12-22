import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus confirm button when dialog opens
      confirmButtonRef.current?.focus();

      // Handle escape key
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onCancel();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: 'bg-state-error hover:bg-red-600',
    warning: 'bg-state-awaiting hover:bg-amber-600',
    default: 'bg-accent hover:bg-accent-bright',
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-expand-in"
      onClick={onCancel}
    >
      <div
        className="bg-surface-800 rounded-xl border border-surface-600 shadow-2xl w-full max-w-sm mx-4 animate-expand-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-600">
          <h2 className="text-lg font-semibold text-theme-primary">{title}</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-theme-secondary">{message}</p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-600 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-theme-secondary hover:text-theme-primary transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-white font-medium rounded-lg transition-colors ${variantStyles[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
