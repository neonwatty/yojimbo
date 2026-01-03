import { Icons } from './Icons';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Reusable error state component for inline error displays
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="w-12 h-12 rounded-full bg-state-error/10 flex items-center justify-center text-state-error mb-4">
        <Icons.alertCircle />
      </div>
      <h3 className="text-sm font-medium text-theme-primary mb-1">{title}</h3>
      <p className="text-xs text-theme-muted text-center max-w-xs mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-700 text-theme-primary text-xs rounded hover:bg-surface-600 transition-colors"
        >
          <Icons.refresh />
          {retryLabel}
        </button>
      )}
    </div>
  );
}
