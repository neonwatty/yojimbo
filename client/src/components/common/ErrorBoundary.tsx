import { Component, ReactNode } from 'react';
import { Icons } from './Icons';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    // Call the onRetry callback to trigger re-fetch/re-render if provided
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4 text-red-400 scale-[2]">
            <Icons.alertCircle />
          </div>
          <h2 className="text-xl font-semibold text-theme-primary mb-2">
            Something went wrong
          </h2>
          <p className="text-theme-muted mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Smaller inline error fallback for component-level boundaries
export function ErrorFallback({
  error,
  onRetry,
  compact = false
}: {
  error?: Error | null;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm">
        <span className="text-red-400 flex-shrink-0">
          <Icons.alertCircle />
        </span>
        <span className="text-red-400 truncate">
          {error?.message || 'Error loading component'}
        </span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-accent hover:underline ml-auto flex-shrink-0"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <span className="text-red-400 mb-2 scale-150">
        <Icons.alertCircle />
      </span>
      <p className="text-theme-muted text-sm mb-3">
        {error?.message || 'Failed to load'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-sm text-accent hover:underline"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
