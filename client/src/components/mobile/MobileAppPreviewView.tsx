import { useState, useRef, useCallback, useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { usePortsStore } from '../../store/portsStore';
import { Terminal, type TerminalRef } from '../terminal';
import { AppPreviewPanel } from '../app-preview';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Icons } from '../common/Icons';
import { MobileTextInput } from './MobileTextInput';
import type { Instance } from '@cc-orchestrator/shared';

type Screen = 'terminal' | 'preview';

interface MobileTerminalWithPreviewProps {
  instance: Instance;
  onTopGesture: () => void;
  onBottomGesture: () => void;
  terminalRef: React.RefObject<TerminalRef>;
}

export function MobileTerminalWithPreview({
  instance,
  onTopGesture,
  onBottomGesture,
  terminalRef,
}: MobileTerminalWithPreviewProps) {
  const { theme } = useSettingsStore();
  const { instancePorts } = usePortsStore();
  const ports = instancePorts[instance.id]?.ports || [];
  const hasPorts = ports.length > 0;
  const isLocalInstance = instance.machineType === 'local';

  const [activeScreen, setActiveScreen] = useState<Screen>('terminal');
  const containerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef({ startX: 0, startY: 0, zone: null as string | null });

  // Handle edge zone detection and vertical gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relativeY = touch.clientY - rect.top;
    const height = rect.height;

    // Determine which zone the touch started in
    let zone: string | null = null;
    if (relativeY < 60) {
      zone = 'top';
    } else if (relativeY > height - 60) {
      zone = 'bottom';
    }

    touchRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      zone,
    };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const { startX, startY, zone } = touchRef.current;

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    // Vertical edge gestures
    if (zone) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 50) {
        if (zone === 'top' && deltaY > 0) {
          onTopGesture();
          return;
        } else if (zone === 'bottom' && deltaY < 0) {
          onBottomGesture();
          return;
        }
      }
    }

    // Horizontal swipe for screen switching (only for local instances with ports)
    if (isLocalInstance && hasPorts && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 80) {
      if (deltaX < 0 && activeScreen === 'terminal') {
        // Swipe left → show preview
        setActiveScreen('preview');
      } else if (deltaX > 0 && activeScreen === 'preview') {
        // Swipe right → show terminal
        setActiveScreen('terminal');
      }
    }
  }, [isLocalInstance, hasPorts, activeScreen, onTopGesture, onBottomGesture]);

  // Reset to terminal when instance changes
  useEffect(() => {
    setActiveScreen('terminal');
  }, [instance.id]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative bg-surface-900 w-full max-w-full"
      style={{ maxWidth: '100vw' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Screen container with horizontal slide */}
      <div
        className="absolute inset-0 flex transition-transform duration-300 ease-out"
        style={{
          transform: activeScreen === 'preview' ? 'translateX(-100%)' : 'translateX(0)',
          width: '200%',
        }}
      >
        {/* Terminal Screen */}
        <div className="w-1/2 h-full" style={{ touchAction: 'pan-y' }}>
          <ErrorBoundary
            fallback={
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-6">
                  <span className="text-red-400 scale-150 inline-block mb-2">
                    <Icons.alertCircle />
                  </span>
                  <p className="text-theme-muted text-sm">Terminal failed to load</p>
                </div>
              </div>
            }
          >
            <Terminal
              ref={terminalRef}
              instanceId={instance.id}
              theme={theme === 'dark' ? 'dark' : 'light'}
              fontSize={10}
            />
          </ErrorBoundary>

          {/* Mobile Text Input - for speech-to-text workaround */}
          <MobileTextInput instanceId={instance.id} />
        </div>

        {/* App Preview Screen - only render for local instances */}
        <div className="w-1/2 h-full">
          {isLocalInstance ? (
            <AppPreviewPanel
              instanceId={instance.id}
              className="h-full"
              showHeader={true}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-surface-800">
              <div className="text-center text-theme-muted p-6">
                <Icons.link />
                <p className="mt-2 text-sm">App Preview is only available for local instances</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Visual hint indicators */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>

      {/* Screen indicator dots (only show when preview is available) */}
      {isLocalInstance && hasPorts && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20 pointer-events-none">
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              activeScreen === 'terminal' ? 'bg-accent' : 'bg-surface-500'
            }`}
          />
          <div
            className={`w-2 h-2 rounded-full transition-colors ${
              activeScreen === 'preview' ? 'bg-accent' : 'bg-surface-500'
            }`}
          />
        </div>
      )}

      {/* Tab bar for switching (easier than just swiping) */}
      {isLocalInstance && hasPorts && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex bg-surface-700/90 backdrop-blur rounded-lg p-1 z-20">
          <button
            onClick={() => setActiveScreen('terminal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
              activeScreen === 'terminal'
                ? 'bg-accent text-surface-900'
                : 'text-theme-muted'
            }`}
          >
            <Icons.terminal />
            <span>Terminal</span>
          </button>
          <button
            onClick={() => setActiveScreen('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
              activeScreen === 'preview'
                ? 'bg-accent text-surface-900'
                : 'text-theme-muted'
            }`}
          >
            <Icons.externalLink />
            <span>Preview</span>
          </button>
        </div>
      )}
    </div>
  );
}
