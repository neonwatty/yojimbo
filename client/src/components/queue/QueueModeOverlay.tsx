import { useEffect, useRef, useState } from 'react';
import { useMobileLayout } from '../../hooks/useMobileLayout';
import { calculateSwipe } from '../../utils/gestures';

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
 *
 * Desktop: Full bar with labeled buttons
 * Mobile: Compact header + swipe gestures + bottom navigation
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
  const { isMobile } = useMobileLayout();
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Keyboard shortcuts for queue navigation (desktop)
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

  // Touch/swipe handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setSwipeDirection(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const { direction } = calculateSwipe(
      { clientX: touchStartRef.current.x, clientY: touchStartRef.current.y },
      { clientX: touch.clientX, clientY: touch.clientY }
    );

    if (direction === 'left' || direction === 'right') {
      setSwipeDirection(direction);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const { direction, deltaX } = calculateSwipe(
      { clientX: touchStartRef.current.x, clientY: touchStartRef.current.y },
      { clientX: touch.clientX, clientY: touch.clientY }
    );

    // Require minimum swipe distance of 50px
    if (Math.abs(deltaX) > 50) {
      if (direction === 'left') {
        onSkip();
      } else if (direction === 'right') {
        onNext();
      }
    }

    touchStartRef.current = null;
    setSwipeDirection(null);
  };

  // Complete state
  if (isComplete) {
    if (isMobile) {
      return (
        <>
          {/* Compact mobile header */}
          <div className="bg-state-working/10 border-b border-state-working/30 px-3 py-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-state-working" />
                <span className="text-theme-secondary text-xs">
                  <span className="text-state-working font-semibold">✓</span> All {total} reviewed
                </span>
              </div>
              <button
                onClick={onExit}
                className="px-2 py-1 text-theme-dim text-xs hover:text-theme-primary"
              >
                ✕
              </button>
            </div>
          </div>
          {/* Mobile action buttons */}
          <div className="fixed bottom-0 left-0 right-0 bg-surface-800 border-t border-surface-600 px-4 py-3 z-50">
            <div className="flex gap-3">
              <button
                onClick={onReset}
                className="flex-1 py-3 bg-surface-700 text-theme-primary text-sm font-medium rounded-lg active:bg-surface-600"
              >
                ↻ Start Over
              </button>
              <button
                onClick={onExit}
                className="flex-1 py-3 bg-state-working text-surface-900 text-sm font-medium rounded-lg active:bg-state-working/90"
              >
                Done
              </button>
            </div>
          </div>
        </>
      );
    }

    // Desktop complete state
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

  // Active state - Mobile
  if (isMobile) {
    return (
      <>
        {/* Compact mobile header */}
        <div className="bg-accent/10 border-b border-accent/30 px-3 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-theme-secondary text-xs">
                <span className="text-accent font-semibold">{current}</span>
                <span className="text-theme-dim">/</span>
                <span className="text-accent font-semibold">{total}</span>
                <span className="text-theme-dim ml-1">idle</span>
              </span>
            </div>
            <button
              onClick={onExit}
              className="px-2 py-1 text-theme-dim text-xs hover:text-theme-primary"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Swipe feedback indicator */}
        {swipeDirection && (
          <div className="bg-accent/20 px-3 py-1 text-center">
            <span className="text-accent text-xs">
              {swipeDirection === 'left' ? '← Skipping...' : '→ Next...'}
            </span>
          </div>
        )}

        {/* Mobile swipe gesture footer */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-surface-800 border-t border-surface-600 z-50"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="px-4 py-4">
            {/* Large touch targets */}
            <div className="flex gap-3 mb-3">
              <button
                onClick={onSkip}
                className="flex-1 py-4 bg-surface-700 text-theme-primary text-sm font-medium rounded-lg active:bg-surface-600 flex items-center justify-center gap-2"
              >
                <span className="text-lg">←</span>
                <span>Skip</span>
              </button>
              <button
                onClick={onNext}
                className="flex-1 py-4 bg-accent text-surface-900 text-sm font-medium rounded-lg active:bg-accent/90 flex items-center justify-center gap-2"
              >
                <span>Next</span>
                <span className="text-lg">→</span>
              </button>
            </div>
            {/* Swipe hint */}
            <div className="flex justify-center items-center text-[10px] text-theme-dim">
              <span>👈 Swipe to navigate 👉</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Active state - Desktop
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
