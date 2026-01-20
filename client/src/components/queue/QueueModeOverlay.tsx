import { useEffect } from 'react';

interface QueueModeOverlayProps {
  current: number;
  total: number;
  isComplete: boolean;
  onSkip: () => void;
  onNext: () => void;
  onExit: () => void;
  onReset: () => void;
}

/**
 * Overlay bar shown during Queue Mode when viewing an instance.
 * Provides navigation controls to cycle through idle instances.
 */
export function QueueModeOverlay({
  current,
  total,
  isComplete,
  onSkip,
  onNext,
  onExit,
  onReset,
}: QueueModeOverlayProps) {
  // Keyboard shortcuts for queue navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys when typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSkip, onNext, onExit]);

  if (isComplete) {
    return (
      <div className="bg-state-working/10 border-b border-state-working/30 px-4 py-2 flex-shrink-0 animate-in slide-in-from-top duration-300">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 bg-state-working/20 text-state-working text-xs font-medium rounded">
              COMPLETE
            </span>
            <span className="text-theme-secondary text-sm">
              Reviewed all <span className="text-state-working font-semibold">{total}</span> idle instances
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1 bg-surface-700 hover:bg-surface-600 text-theme-secondary text-xs rounded transition-colors"
            >
              <span>↻</span>
              <span>Start Over</span>
            </button>
            <button
              onClick={onExit}
              className="flex items-center gap-1.5 px-3 py-1 bg-state-working hover:bg-state-working/90 text-surface-900 text-xs font-medium rounded transition-colors"
            >
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-accent/10 border-b border-accent/30 px-4 py-2 flex-shrink-0 animate-in slide-in-from-top duration-300">
      <div className="flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs font-medium rounded">
            QUEUE MODE
          </span>
          <span className="text-theme-secondary text-sm">
            Reviewing <span className="text-accent font-semibold">{current}</span> of{' '}
            <span className="text-accent font-semibold">{total}</span> idle instances
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSkip}
            className="flex items-center gap-1.5 px-3 py-1 bg-surface-700 hover:bg-surface-600 text-theme-secondary text-xs rounded transition-colors"
            title="Skip this instance (Left Arrow)"
          >
            <span>←</span>
            <span>Skip</span>
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 px-3 py-1 bg-accent hover:bg-accent/90 text-surface-900 text-xs font-medium rounded transition-colors"
            title="Go to next instance (Right Arrow)"
          >
            <span>Next</span>
            <span>→</span>
          </button>
          <span className="text-surface-600 mx-1">│</span>
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 px-3 py-1 text-theme-dim hover:text-theme-primary text-xs rounded transition-colors"
            title="Exit queue mode (Escape)"
          >
            <span>Exit</span>
            <span className="text-[10px] opacity-60">Esc</span>
          </button>
        </div>
      </div>
    </div>
  );
}
