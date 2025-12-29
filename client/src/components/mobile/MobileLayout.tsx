import { useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInstancesStore } from '../../store/instancesStore';
import { useUIStore } from '../../store/uiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useMobileLayout } from '../../hooks/useMobileLayout';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getWsUrl } from '../../config';
import { Terminal, type TerminalRef } from '../terminal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Icons } from '../common/Icons';
import type { Instance } from '@cc-orchestrator/shared';

// Mobile Text Input - workaround for iOS speech-to-text issues with xterm.js
function MobileTextInput({
  instanceId,
}: {
  instanceId: string;
}) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { send } = useWebSocket(getWsUrl());

  const handleSend = useCallback(() => {
    if (text.trim()) {
      // Send text to terminal via WebSocket
      send('terminal:input', { instanceId, data: text });
      setText('');
      // Keep expanded for continued input
    }
  }, [text, instanceId, send]);

  const handleSendWithEnter = useCallback(() => {
    if (text.trim()) {
      // Send text + carriage return to simulate Enter
      send('terminal:input', { instanceId, data: text + '\r' });
      setText('');
    }
  }, [text, instanceId, send]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Cmd/Ctrl + Enter sends with newline
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendWithEnter();
    }
  }, [handleSendWithEnter]);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    // Focus textarea after expansion
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, []);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    setText('');
  }, []);

  // Collapsed state - just a microphone/keyboard button
  if (!isExpanded) {
    return (
      <div
        className="absolute bottom-16 left-2 z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      >
        <button
          onClick={handleExpand}
          className="w-12 h-12 rounded-full bg-accent text-surface-900 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          title="Open text input (for speech-to-text)"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      </div>
    );
  }

  // Expanded state - full input bar
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-30 bg-surface-700 border-t border-surface-600"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="flex items-end gap-2 p-2">
        {/* Close button */}
        <button
          onClick={handleCollapse}
          className="w-10 h-10 rounded-full bg-surface-600 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
        >
          <svg className="w-5 h-5 text-theme-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Textarea - iOS will show dictation mic automatically */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or tap mic for speech..."
          className="flex-1 resize-none rounded-xl bg-surface-600 p-3 text-theme-primary placeholder:text-theme-dim text-sm min-h-[44px] max-h-32"
          rows={1}
          style={{
            height: 'auto',
            minHeight: '44px',
          }}
          // Disable autocorrect/autocomplete that might interfere
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-all ${
            text.trim()
              ? 'bg-accent text-surface-900'
              : 'bg-surface-600 text-theme-dim'
          }`}
          title="Send text to terminal"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>

        {/* Send + Enter button */}
        <button
          onClick={handleSendWithEnter}
          disabled={!text.trim()}
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-all ${
            text.trim()
              ? 'bg-frost-3 text-surface-900'
              : 'bg-surface-600 text-theme-dim'
          }`}
          title="Send + Enter"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 10 4 15 9 20" />
            <path d="M20 4v7a4 4 0 0 1-4 4H4" />
          </svg>
        </button>
      </div>

      {/* Hint text */}
      <div className="px-4 pb-2 text-xs text-theme-dim text-center">
        Tap mic on keyboard for speech • ⌘+Enter = send with newline
      </div>
    </div>
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
}: {
  isOpen: boolean;
  onClose: () => void;
  instances: Instance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewInstance: () => void;
}) {
  const touchRef = useRef({ startY: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current.startY = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaY = e.changedTouches[0].clientY - touchRef.current.startY;
    if (deltaY > 80) onClose();
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
              <button
                key={instance.id}
                onClick={() => {
                  onSelect(instance.id);
                  onClose();
                }}
                className={`w-full p-4 rounded-xl text-left active:scale-[0.98] transition-all ${
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
              </button>
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
  onOpenSettings,
  onNavigateHome,
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
  onOpenSettings: () => void;
  onNavigateHome: () => void;
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
          <div className="flex gap-2 mt-3">
            {/* Home button */}
            <button
              onClick={() => {
                onNavigateHome();
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-600 rounded-xl active:scale-[0.98] transition-transform"
            >
              <Icons.home />
              <span className="text-sm text-theme-primary">Home</span>
            </button>

            {/* Settings button */}
            <button
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-surface-600 rounded-xl active:scale-[0.98] transition-transform"
            >
              <Icons.settings />
              <span className="text-sm text-theme-primary">Settings</span>
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

// Mobile Terminal View - gestures handled by floating buttons instead
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

  return (
    <div className="flex-1 overflow-hidden relative bg-surface-900">
      {/* Terminal - no touch handlers to interfere with input */}
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

      {/* Mobile Text Input - for speech-to-text workaround */}
      <MobileTextInput instanceId={instanceId} />

      {/* Floating buttons for navigation instead of gestures */}
      <div className="absolute top-2 right-2 z-20 flex gap-2">
        <button
          onClick={onTopGesture}
          className="w-10 h-10 rounded-full bg-surface-700/80 backdrop-blur flex items-center justify-center active:scale-95 transition-transform"
        >
          <Icons.settings />
        </button>
      </div>
      <div className="absolute bottom-2 right-2 z-20">
        <button
          onClick={onBottomGesture}
          className="w-10 h-10 rounded-full bg-surface-700/80 backdrop-blur flex items-center justify-center active:scale-95 transition-transform"
        >
          <Icons.instances />
        </button>
      </div>
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
  const { id } = useParams();
  const { instances, setActiveInstanceId } = useInstancesStore();
  const { setShowSettingsModal, setShowNewInstanceModal } = useUIStore();
  const { isFullscreen, isStandalone, fullscreenSupported, isIOS, isIOSSafari, toggleFullscreen } = useMobileLayout();

  const [bottomDrawerOpen, setBottomDrawerOpen] = useState(false);
  const [topDrawerOpen, setTopDrawerOpen] = useState(false);

  const terminalRefs = useRef<Map<string, TerminalRef>>(new Map());

  const currentInstance = id ? instances.find(i => i.id === id) ?? null : null;

  // Handle instance selection
  const handleSelectInstance = useCallback((instanceId: string) => {
    setActiveInstanceId(instanceId);
    navigate(`/instances/${instanceId}`);
  }, [navigate, setActiveInstanceId]);

  // Handle new instance
  const handleNewInstance = useCallback(() => {
    setBottomDrawerOpen(false);
    setShowNewInstanceModal(true);
  }, [setShowNewInstanceModal]);

  // If we have an ID but no matching instance, show empty state
  if (id && !currentInstance) {
    return (
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
          onOpenSettings={() => setShowSettingsModal(true)}
          onNavigateHome={() => navigate('/')}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface-900">
      {/* Main content */}
      {currentInstance ? (
        <MobileTerminalView
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
        onOpenSettings={() => setShowSettingsModal(true)}
        onNavigateHome={() => navigate('/')}
      />
    </div>
  );
}

export default MobileLayout;
