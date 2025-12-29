import { useState, useRef, useCallback } from 'react';
import { instancesApi } from '../../api/client';

interface MobileTextInputProps {
  instanceId: string;
}

/**
 * Mobile Text Input - workaround for iOS speech-to-text issues with xterm.js.
 * Provides a native textarea overlay that works with iOS dictation.
 */
export function MobileTextInput({ instanceId }: MobileTextInputProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (text.trim()) {
      // Send text to terminal via HTTP API (no WebSocket needed)
      instancesApi.sendInput(instanceId, text);
      setText('');
      // Keep expanded for continued input
    }
  }, [text, instanceId]);

  const handleSendWithEnter = useCallback(() => {
    if (text.trim()) {
      // Send text + carriage return to simulate Enter via HTTP API
      instancesApi.sendInput(instanceId, text + '\r');
      setText('');
    }
  }, [text, instanceId]);

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

  // Collapsed state - just a microphone/keyboard button (right side for right-handed users)
  if (!isExpanded) {
    return (
      <div
        className="absolute bottom-16 right-2 z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        data-testid="mobile-text-input-collapsed"
      >
        <button
          onClick={handleExpand}
          className="w-12 h-12 rounded-full bg-accent text-surface-900 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          title="Open text input (for speech-to-text)"
          data-testid="expand-button"
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
      data-testid="mobile-text-input-expanded"
    >
      <div className="flex items-end gap-2 p-2">
        {/* Close button */}
        <button
          onClick={handleCollapse}
          className="w-10 h-10 rounded-full bg-surface-600 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          data-testid="collapse-button"
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
          data-testid="text-input"
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
          data-testid="send-button"
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
          data-testid="send-enter-button"
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

export default MobileTextInput;
