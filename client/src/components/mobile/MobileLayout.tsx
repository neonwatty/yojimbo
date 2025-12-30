import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useInstancesStore } from '../../store/instancesStore';
import { useUIStore } from '../../store/uiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useMobileLayout } from '../../hooks/useMobileLayout';
import { useOrientation } from '../../hooks/useOrientation';
import { toast } from '../../store/toastStore';
import { instancesApi } from '../../api/client';
import { Terminal, type TerminalRef } from '../terminal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Icons } from '../common/Icons';
import { MobileTextInput } from './MobileTextInput';
import { MobileHomeView } from './MobileHomeView';
import { MobileHistoryView } from './MobileHistoryView';
import { MobileActivityView } from './MobileActivityView';
import type { Instance } from '@cc-orchestrator/shared';

// Connection Status Indicator
function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
      isConnected ? 'bg-state-working/20 text-state-working' : 'bg-state-error/20 text-state-error'
    }`}>
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-state-working' : 'bg-state-error'}`} />
      <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
    </div>
  );
}

// Offline Indicator for PWA
function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-state-awaiting text-surface-900 text-xs text-center py-1 z-[200]">
      You're offline - some features may be unavailable
    </div>
  );
}

// Long-press action sheet for instances
function InstanceActionSheet({
  isOpen,
  onClose,
  instance,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  instance: Instance | null;
  onDelete: (id: string) => void;
}) {
  if (!isOpen || !instance) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={onClose}
      />

      {/* Action Sheet */}
      <div
        className="fixed left-2 right-2 bottom-2 bg-surface-700 rounded-2xl z-[60] overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <div className="p-4 border-b border-surface-600">
          <h3 className="font-medium text-theme-primary">{instance.name}</h3>
          <p className="text-xs text-theme-dim truncate">{instance.workingDir}</p>
        </div>

        <div className="p-2">
          <button
            onClick={() => {
              onDelete(instance.id);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-state-error active:bg-surface-600"
          >
            <Icons.trash />
            <span>Delete Instance</span>
          </button>
        </div>

        <div className="p-2 border-t border-surface-600">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-theme-primary font-medium active:bg-surface-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

// Landscape Sidebar - persistent left sidebar for landscape mode
function LandscapeSidebar({
  instances,
  selectedId,
  onSelect,
  onNewInstance,
  onOpenSettings,
  onLongPress,
  isConnected,
}: {
  instances: Instance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewInstance: () => void;
  onOpenSettings: () => void;
  onLongPress: (instance: Instance) => void;
  isConnected: boolean;
}) {
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const handleInstanceTouchStart = (instance: Instance) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress(instance);
    }, 500);
  };

  const handleInstanceTouchEnd = (instance: Instance) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!longPressTriggeredRef.current) {
      onSelect(instance.id);
    }
  };

  const handleInstanceTouchMove = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <aside
      className="h-full flex flex-col bg-surface-800 border-r border-surface-600"
      style={{
        width: '200px',
        minWidth: '200px',
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-surface-600">
        <h2 className="text-sm font-semibold text-theme-primary">Instances</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-theme-dim hover:text-theme-primary rounded-lg hover:bg-surface-600 transition-colors"
            aria-label="Settings"
          >
            <Icons.settings />
          </button>
        </div>
      </div>

      {/* Connection status */}
      <div className="px-3 py-2 border-b border-surface-600/50">
        <div className={`flex items-center gap-1.5 text-xs ${
          isConnected ? 'text-state-working' : 'text-state-error'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-state-working' : 'bg-state-error'}`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Instance list */}
      <div className="flex-1 overflow-y-auto py-2">
        {instances.length === 0 ? (
          <p className="text-xs text-theme-dim text-center py-4 px-3">No instances yet</p>
        ) : (
          <div className="flex flex-col gap-1 px-2">
            {instances.map((instance) => (
              <button
                key={instance.id}
                onTouchStart={() => handleInstanceTouchStart(instance)}
                onTouchEnd={() => handleInstanceTouchEnd(instance)}
                onTouchMove={handleInstanceTouchMove}
                onClick={() => onSelect(instance.id)}
                className={`w-full text-left p-2 rounded-lg transition-colors ${
                  selectedId === instance.id
                    ? 'bg-accent/20 border border-accent/50'
                    : 'hover:bg-surface-600 active:bg-surface-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    instance.status === 'working' ? 'bg-state-working' :
                    instance.status === 'awaiting' ? 'bg-state-awaiting' :
                    instance.status === 'error' ? 'bg-state-error' :
                    'bg-surface-500'
                  }`} />
                  <span className="text-xs font-medium text-theme-primary truncate">
                    {instance.name}
                  </span>
                </div>
                <p className="text-[10px] text-theme-dim truncate mt-0.5 pl-4">
                  {instance.workingDir.split('/').pop()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* New Instance button */}
      <div className="p-2 border-t border-surface-600">
        <button
          onClick={onNewInstance}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent text-surface-900 rounded-lg text-xs font-medium active:scale-95 transition-transform"
        >
          <Icons.plus />
          New Instance
        </button>
      </div>
    </aside>
  );
}

// Instance Drawer (bottom, swipe up)
function InstanceDrawer({
  isOpen,
  onClose,
  instances,
  selectedId,
  onSelect,
  onNewInstance,
  onLongPress,
}: {
  isOpen: boolean;
  onClose: () => void;
  instances: Instance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewInstance: () => void;
  onLongPress: (instance: Instance) => void;
}) {
  const touchRef = useRef({ startY: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current.startY = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchRef.current.startY;
    if (deltaY > 80) onClose();
  };

  const handleInstanceTouchStart = (instance: Instance) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onLongPress(instance);
    }, 500); // 500ms for long press
  };

  const handleInstanceTouchEnd = (instance: Instance) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Only trigger select if it wasn't a long press
    if (!longPressTriggeredRef.current) {
      onSelect(instance.id);
      onClose();
    }
  };

  const handleInstanceTouchMove = () => {
    // Cancel long press if user moves finger
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed left-0 right-0 bottom-0 bg-surface-700 rounded-t-2xl z-50 transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '70vh', paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        {/* Handle - swipe down here to close */}
        <div
          className="flex justify-center py-4 cursor-grab"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-surface-500 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="text-lg font-semibold text-theme-primary">Instances</h2>
          <button
            onClick={onNewInstance}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-surface-900 rounded-lg font-medium active:scale-95 transition-transform"
          >
            <Icons.plus />
            New
          </button>
        </div>

        {/* Hint for long-press */}
        {instances.length > 0 && (
          <p className="text-xs text-theme-dim text-center pb-2">Long-press for options</p>
        )}

        {/* Instance List */}
        <div
          className="flex-1 px-4 pb-4 min-h-0"
          style={{
            overflowY: 'scroll',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain'
          }}
        >
          <div className="space-y-2">
            {instances.map(instance => (
              <div
                key={instance.id}
                onTouchStart={() => handleInstanceTouchStart(instance)}
                onTouchEnd={() => handleInstanceTouchEnd(instance)}
                onTouchMove={handleInstanceTouchMove}
                className={`w-full p-4 rounded-xl text-left active:scale-[0.98] transition-all select-none ${
                  selectedId === instance.id
                    ? 'bg-surface-500 ring-2 ring-accent'
                    : 'bg-surface-600 active:bg-surface-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      instance.status === 'working' ? 'bg-state-working' :
                      instance.status === 'awaiting' ? 'bg-state-awaiting' :
                      instance.status === 'error' ? 'bg-state-error' :
                      'bg-state-idle'
                    }`}
                  />
                  <span className="font-medium text-theme-primary flex-1 truncate">{instance.name}</span>
                  {instance.machineType === 'remote' && (
                    <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent">
                      Remote
                    </span>
                  )}
                </div>
                <p className="text-sm text-theme-dim mt-1 truncate pl-5">{instance.workingDir}</p>
              </div>
            ))}

            {instances.length === 0 && (
              <div className="text-center py-8 text-theme-muted">
                <Icons.terminal />
                <p className="mt-2 text-sm">No instances yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Settings Drawer (top, swipe down)
function SettingsDrawer({
  isOpen,
  onClose,
  currentInstance,
  onFullscreen,
  isFullscreen,
  isStandalone,
  fullscreenSupported,
  isIOS,
  isIOSSafari,
  isConnected,
  onOpenSettings,
  onNavigateHome,
  onNavigateHistory,
  onNavigateActivity,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentInstance: Instance | null;
  onFullscreen: () => void;
  isFullscreen: boolean;
  isStandalone: boolean;
  fullscreenSupported: boolean;
  isIOS: boolean;
  isIOSSafari: boolean;
  isConnected: boolean;
  onOpenSettings: () => void;
  onNavigateHome: () => void;
  onNavigateHistory: () => void;
  onNavigateActivity: () => void;
}) {
  const touchRef = useRef({ startY: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current.startY = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchRef.current.startY;
    if (deltaY < -80) onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed left-0 right-0 top-0 bg-surface-700 rounded-b-2xl z-50 transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="px-4 py-4">
          {/* Current instance info */}
          {currentInstance && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    currentInstance.status === 'working' ? 'bg-state-working pulse-working' :
                    currentInstance.status === 'awaiting' ? 'bg-state-awaiting' :
                    currentInstance.status === 'error' ? 'bg-state-error' :
                    'bg-state-idle'
                  }`}
                />
                <span className="font-semibold text-theme-primary">{currentInstance.name}</span>
              </div>
              <span className="text-sm text-theme-dim">
                {currentInstance.machineType === 'remote' ? 'Remote' : 'Local'}
              </span>
            </div>
          )}

          {!currentInstance && (
            <div className="py-2 text-theme-muted text-center">
              No instance selected
            </div>
          )}

          {/* Connection Status */}
          <div className="flex justify-center py-2">
            <ConnectionStatus isConnected={isConnected} />
          </div>

          {/* Fullscreen / Add to Home Screen */}
          {!isStandalone && fullscreenSupported && (
            <button
              onClick={() => {
                onFullscreen();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 mt-3 bg-surface-600 rounded-xl active:scale-[0.98] transition-transform"
            >
              {isFullscreen ? (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                  <span className="text-sm text-theme-primary">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                  <span className="text-sm text-theme-primary">Enter Fullscreen</span>
                </>
              )}
            </button>
          )}

          {/* iOS Safari: Show Add to Home Screen instructions */}
          {!isStandalone && isIOSSafari && (
            <div className="mt-3 p-4 bg-surface-600 rounded-xl border border-surface-500">
              <p className="text-sm font-medium text-theme-primary text-center mb-3">
                For fullscreen mode on iOS:
              </p>
              <div className="space-y-2 text-sm text-theme-muted">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent font-bold">1</div>
                  <span>Tap Safari's <strong className="text-theme-primary">Share</strong> button below</span>
                  <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent font-bold">2</div>
                  <span>Scroll and tap <strong className="text-theme-primary">"Add to Home Screen"</strong></span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs text-accent font-bold">3</div>
                  <span>Open from home screen for fullscreen</span>
                </div>
              </div>
            </div>
          )}

          {/* iOS Chrome/other: Tell them to use Safari */}
          {!isStandalone && isIOS && !isIOSSafari && (
            <div className="mt-3 p-3 bg-surface-600 rounded-xl border border-surface-500">
              <p className="text-sm text-theme-muted text-center">
                For fullscreen, open in <strong className="text-theme-primary">Safari</strong> and add to Home Screen
              </p>
            </div>
          )}

          {isStandalone && (
            <div className="py-2 text-xs text-center text-theme-dim">
              Running as standalone app
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            {/* Home button */}
            <button
              onClick={() => {
                onNavigateHome();
                onClose();
              }}
              className="flex flex-col items-center justify-center gap-1 py-3 bg-surface-600 rounded-xl active:scale-[0.98] transition-transform"
            >
              <Icons.home />
              <span className="text-[10px] text-theme-primary">Home</span>
            </button>

            {/* History button */}
            <button
              onClick={() => {
                onNavigateHistory();
                onClose();
              }}
              className="flex flex-col items-center justify-center gap-1 py-3 bg-surface-600 rounded-xl active:scale-[0.98] transition-transform"
            >
              <Icons.history />
              <span className="text-[10px] text-theme-primary">History</span>
            </button>

            {/* Activity button */}
            <button
              onClick={() => {
                onNavigateActivity();
                onClose();
              }}
              className="flex flex-col items-center justify-center gap-1 py-3 bg-surface-600 rounded-xl active:scale-[0.98] transition-transform"
            >
              <Icons.activity />
              <span className="text-[10px] text-theme-primary">Activity</span>
            </button>

            {/* Settings button */}
            <button
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
              className="flex flex-col items-center justify-center gap-1 py-3 bg-surface-600 rounded-xl active:scale-[0.98] transition-transform"
            >
              <Icons.settings />
              <span className="text-[10px] text-theme-primary">Settings</span>
            </button>
          </div>
        </div>

        {/* Handle */}
        <div className="flex justify-center pb-3">
          <div className="w-10 h-1 bg-surface-500 rounded-full" />
        </div>
      </div>
    </>
  );
}

// Mobile Terminal View - edge swipe gestures for navigation
function MobileTerminalView({
  instanceId,
  onTopGesture,
  onBottomGesture,
  terminalRef,
}: {
  instanceId: string;
  onTopGesture: () => void;
  onBottomGesture: () => void;
  terminalRef: React.RefObject<TerminalRef>;
}) {
  const { theme } = useSettingsStore();
  const inputLockStatus = useInstancesStore((state) => state.inputLockStatus);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef({ startY: 0, startX: 0, zone: null as string | null });

  // Edge zone detection and gesture handling
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
      startY: touch.clientY,
      startX: touch.clientX,
      zone,
    };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const { startY, startX, zone } = touchRef.current;

    if (!zone) return; // Not started in an edge zone

    const deltaY = touch.clientY - startY;
    const deltaX = Math.abs(touch.clientX - startX);

    // Must be primarily vertical swipe (not horizontal scroll)
    if (deltaX > Math.abs(deltaY)) return;

    // Minimum swipe distance
    const minSwipe = 50;

    if (zone === 'top' && deltaY > minSwipe) {
      // Swipe down from top edge → open settings
      onTopGesture();
    } else if (zone === 'bottom' && deltaY < -minSwipe) {
      // Swipe up from bottom edge → open instances
      onBottomGesture();
    }
  }, [onTopGesture, onBottomGesture]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden relative bg-surface-900 w-full max-w-full"
      style={{ maxWidth: '100vw' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Terminal - constrained to viewport width */}
      <div className="absolute inset-0 overflow-hidden">
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
            instanceId={instanceId}
            theme={theme === 'dark' ? 'dark' : 'light'}
          />
        </ErrorBoundary>
      </div>

      {/* Mobile Text Input - for speech-to-text workaround */}
      <MobileTextInput instanceId={instanceId} />

      {/* Visual hint indicators (non-interactive) */}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 pointer-events-none z-10">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>

      {/* Lock Status Indicator */}
      {inputLockStatus[instanceId] && (
        <div
          className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs z-10 ${
            inputLockStatus[instanceId].hasLock
              ? 'bg-aurora-green/20 text-aurora-green'
              : 'bg-aurora-red/20 text-aurora-red'
          }`}
        >
          <Icons.lock />
          <span>{inputLockStatus[instanceId].hasLock ? 'Active' : 'View Only'}</span>
        </div>
      )}
    </div>
  );
}

// Empty state when no instance is selected
function EmptyState({
  onNewInstance,
  onTopGesture,
  onBottomGesture,
}: {
  onNewInstance: () => void;
  onTopGesture?: () => void;
  onBottomGesture?: () => void;
}) {
  const touchRef = useRef({ startY: 0, zone: null as string | null });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = touch.clientY - rect.top;
    const height = rect.height;

    let zone = 'middle';
    if (relativeY < 80) zone = 'top';
    else if (relativeY > height - 80) zone = 'bottom';

    touchRef.current = { startY: touch.clientY, zone };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const { startY, zone } = touchRef.current;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaY) > 50) {
      if (zone === 'top' && deltaY > 0 && onTopGesture) {
        onTopGesture();
      } else if (zone === 'bottom' && deltaY < 0 && onBottomGesture) {
        onBottomGesture();
      }
    }
  }, [onTopGesture, onBottomGesture]);

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center bg-surface-800 p-6"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="text-theme-dim mb-4">
        <Icons.terminal />
      </div>
      <h3 className="text-lg font-medium text-theme-primary mb-2">No Session Selected</h3>
      <p className="text-sm text-theme-muted text-center mb-6">
        Swipe up to select an instance or create a new one
      </p>
      <button
        onClick={onNewInstance}
        className="flex items-center gap-2 px-6 py-3 bg-accent text-surface-900 rounded-xl font-medium active:scale-95 transition-transform"
      >
        <Icons.plus />
        New Session
      </button>
    </div>
  );
}

// Main Mobile Layout
export function MobileLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const { instances, setActiveInstanceId, removeInstance } = useInstancesStore();

  // Check if we're on the home page, history page, or activity page
  const isHomePage = location.pathname === '/';
  const isHistoryPage = location.pathname === '/history';
  const isActivityPage = location.pathname === '/activity';
  const { setShowSettingsModal, setShowNewInstanceModal, isConnected } = useUIStore();
  const { isFullscreen, isStandalone, fullscreenSupported, isIOS, isIOSSafari, toggleFullscreen } = useMobileLayout();
  const isLandscape = useOrientation();

  const [bottomDrawerOpen, setBottomDrawerOpen] = useState(false);
  const [topDrawerOpen, setTopDrawerOpen] = useState(false);
  const [actionSheetInstance, setActionSheetInstance] = useState<Instance | null>(null);

  const terminalRefs = useRef<Map<string, TerminalRef>>(new Map());

  const currentInstance = id ? instances.find(i => i.id === id) ?? null : null;

  // Handle instance selection
  const handleSelectInstance = useCallback((instanceId: string) => {
    const instance = instances.find(i => i.id === instanceId);
    setActiveInstanceId(instanceId);
    navigate(`/instances/${instanceId}`);
    if (instance) {
      toast.info(`Switched to ${instance.name}`, 2000);
    }
  }, [navigate, setActiveInstanceId, instances]);

  // Handle new instance
  const handleNewInstance = useCallback(() => {
    setBottomDrawerOpen(false);
    setShowNewInstanceModal(true);
  }, [setShowNewInstanceModal]);

  // Handle long-press on instance
  const handleInstanceLongPress = useCallback((instance: Instance) => {
    setActionSheetInstance(instance);
  }, []);

  // Handle instance deletion
  const handleDeleteInstance = useCallback(async (instanceId: string) => {
    try {
      await instancesApi.close(instanceId);
      removeInstance(instanceId);
      toast.success('Instance deleted');
      // Navigate away if we deleted the current instance
      if (id === instanceId) {
        navigate('/instances');
      }
    } catch {
      toast.error('Failed to delete instance');
    }
  }, [id, navigate, removeInstance]);

  // If we have an ID but no matching instance, show empty state
  if (id && !currentInstance) {
    // Landscape empty state
    if (isLandscape) {
      return (
        <>
          <OfflineIndicator />
          <div className="h-full flex flex-row bg-surface-900">
            <LandscapeSidebar
              instances={instances}
              selectedId={null}
              onSelect={handleSelectInstance}
              onNewInstance={handleNewInstance}
              onOpenSettings={() => setShowSettingsModal(true)}
              onLongPress={handleInstanceLongPress}
              isConnected={isConnected}
            />
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-theme-dim">
                <p className="text-sm">Instance not found</p>
                <p className="text-xs mt-1">Select another instance from the sidebar</p>
              </div>
            </div>
            <InstanceActionSheet
              isOpen={!!actionSheetInstance}
              onClose={() => setActionSheetInstance(null)}
              instance={actionSheetInstance}
              onDelete={handleDeleteInstance}
            />
          </div>
        </>
      );
    }

    // Portrait empty state
    return (
      <>
        <OfflineIndicator />
        <div className="h-full flex flex-col bg-surface-900">
          <EmptyState
            onNewInstance={handleNewInstance}
            onTopGesture={() => setTopDrawerOpen(true)}
            onBottomGesture={() => setBottomDrawerOpen(true)}
          />
          <InstanceDrawer
            isOpen={bottomDrawerOpen}
            onClose={() => setBottomDrawerOpen(false)}
            instances={instances}
            selectedId={null}
            onSelect={handleSelectInstance}
            onNewInstance={handleNewInstance}
            onLongPress={handleInstanceLongPress}
          />
          <SettingsDrawer
            isOpen={topDrawerOpen}
            onClose={() => setTopDrawerOpen(false)}
            currentInstance={null}
            onFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            isStandalone={isStandalone}
            fullscreenSupported={fullscreenSupported}
            isIOS={isIOS}
            isIOSSafari={isIOSSafari}
            isConnected={isConnected}
            onOpenSettings={() => setShowSettingsModal(true)}
            onNavigateHome={() => navigate('/')}
            onNavigateHistory={() => navigate('/history')}
            onNavigateActivity={() => navigate('/activity')}
          />
          <InstanceActionSheet
            isOpen={!!actionSheetInstance}
            onClose={() => setActionSheetInstance(null)}
            instance={actionSheetInstance}
            onDelete={handleDeleteInstance}
          />
        </div>
      </>
    );
  }

  // Landscape layout: side-by-side with persistent sidebar
  if (isLandscape) {
    return (
      <>
        <OfflineIndicator />
        <div className="h-full flex flex-row bg-surface-900">
          {/* Left sidebar with instances */}
          <LandscapeSidebar
            instances={instances}
            selectedId={currentInstance?.id || null}
            onSelect={handleSelectInstance}
            onNewInstance={handleNewInstance}
            onOpenSettings={() => setShowSettingsModal(true)}
            onLongPress={handleInstanceLongPress}
            isConnected={isConnected}
          />

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0">
            {isHomePage ? (
              <MobileHomeView
                onTopGesture={() => {}} // No gestures in landscape - sidebar handles navigation
                onBottomGesture={() => {}}
                onViewAllInstances={() => {}} // In landscape, sidebar is always visible
              />
            ) : isHistoryPage ? (
              <MobileHistoryView
                onTopGesture={() => {}}
                onBottomGesture={() => {}}
              />
            ) : isActivityPage ? (
              <MobileActivityView
                onTopGesture={() => {}}
                onBottomGesture={() => {}}
              />
            ) : currentInstance ? (
              <MobileTerminalView
                key={currentInstance.id}
                instanceId={currentInstance.id}
                onTopGesture={() => {}} // No top gesture in landscape - settings in sidebar
                onBottomGesture={() => {}} // No bottom gesture in landscape - list in sidebar
                terminalRef={{ current: terminalRefs.current.get(currentInstance.id) || null } as React.RefObject<TerminalRef>}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-theme-dim">
                  <p className="text-sm">Select an instance from the sidebar</p>
                  <p className="text-xs mt-1">or create a new one</p>
                </div>
              </div>
            )}
          </div>

          {/* Long-press action sheet */}
          <InstanceActionSheet
            isOpen={!!actionSheetInstance}
            onClose={() => setActionSheetInstance(null)}
            instance={actionSheetInstance}
            onDelete={handleDeleteInstance}
          />
        </div>
      </>
    );
  }

  // Portrait layout: full-screen with drawer gestures
  return (
    <>
      <OfflineIndicator />
      <div className="h-full flex flex-col bg-surface-900">
        {/* Main content */}
        {isHomePage ? (
          <MobileHomeView
            onTopGesture={() => setTopDrawerOpen(true)}
            onBottomGesture={() => setBottomDrawerOpen(true)}
            onViewAllInstances={() => setBottomDrawerOpen(true)}
          />
        ) : isHistoryPage ? (
          <MobileHistoryView
            onTopGesture={() => setTopDrawerOpen(true)}
            onBottomGesture={() => setBottomDrawerOpen(true)}
          />
        ) : isActivityPage ? (
          <MobileActivityView
            onTopGesture={() => setTopDrawerOpen(true)}
            onBottomGesture={() => setBottomDrawerOpen(true)}
          />
        ) : currentInstance ? (
          <MobileTerminalView
            key={currentInstance.id}
            instanceId={currentInstance.id}
            onTopGesture={() => setTopDrawerOpen(true)}
            onBottomGesture={() => setBottomDrawerOpen(true)}
            terminalRef={{ current: terminalRefs.current.get(currentInstance.id) || null } as React.RefObject<TerminalRef>}
          />
        ) : (
          <EmptyState
            onNewInstance={handleNewInstance}
            onTopGesture={() => setTopDrawerOpen(true)}
            onBottomGesture={() => setBottomDrawerOpen(true)}
          />
        )}

        {/* Bottom drawer - Instance list */}
        <InstanceDrawer
          isOpen={bottomDrawerOpen}
          onClose={() => setBottomDrawerOpen(false)}
          instances={instances}
          selectedId={currentInstance?.id || null}
          onSelect={handleSelectInstance}
          onNewInstance={handleNewInstance}
          onLongPress={handleInstanceLongPress}
        />

        {/* Top drawer - Settings */}
        <SettingsDrawer
          isOpen={topDrawerOpen}
          onClose={() => setTopDrawerOpen(false)}
          currentInstance={currentInstance}
          onFullscreen={toggleFullscreen}
          isFullscreen={isFullscreen}
          isStandalone={isStandalone}
          fullscreenSupported={fullscreenSupported}
          isIOS={isIOS}
          isIOSSafari={isIOSSafari}
          isConnected={isConnected}
          onOpenSettings={() => setShowSettingsModal(true)}
          onNavigateHome={() => navigate('/')}
          onNavigateHistory={() => navigate('/history')}
          onNavigateActivity={() => navigate('/activity')}
        />

        {/* Long-press action sheet */}
        <InstanceActionSheet
          isOpen={!!actionSheetInstance}
          onClose={() => setActionSheetInstance(null)}
          instance={actionSheetInstance}
          onDelete={handleDeleteInstance}
        />
      </div>
    </>
  );
}

export default MobileLayout;
