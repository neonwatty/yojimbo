import { useState, useRef, useCallback } from 'react';
import { instancesApi } from '../../api/client';
import { toast } from '../../store/toastStore';

interface MobileTextInputProps {
  instanceId: string;
}

/**
 * Mobile Voice Input - Modal for speech-to-text input on mobile.
 *
 * Features:
 * - Tap mic FAB: Opens modal for voice/text input
 * - Large, high-contrast textarea for easy reading
 * - Send: Types text into terminal
 * - Send + Enter: Types text and presses Enter to submit
 */
export function MobileTextInput({ instanceId }: MobileTextInputProps) {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    if (text.trim()) {
      instancesApi.sendInput(instanceId, text);
      setText('');
    }
  }, [text, instanceId]);

  const handleSendWithEnter = useCallback(async () => {
    if (text.trim()) {
      // Send text first, then carriage return separately
      // This mimics how xterm.js sends keyboard input (character by character)
      try {
        // Send text first
        await instancesApi.sendInput(instanceId, text);
        // Small delay then send Enter
        await new Promise(resolve => setTimeout(resolve, 50));
        await instancesApi.sendInput(instanceId, '\r');
        toast.success(`Sent: "${text.slice(0, 20)}${text.length > 20 ? '...' : ''}"`);
      } catch (error) {
        console.error('[MobileTextInput] Send failed:', error);
        toast.error(`Send failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      setText('');
      setIsExpanded(false);
    }
  }, [text, instanceId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendWithEnter();
    }
  }, [handleSendWithEnter]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  }, []);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    setText('');
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCollapse();
    }
  }, [handleCollapse]);

  // Collapsed state - mic FAB
  if (!isExpanded) {
    return (
      <div
        className="absolute bottom-16 right-2 z-20"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
        data-testid="mobile-text-input-collapsed"
      >
        <button
          onClick={handleExpand}
          className="w-14 h-14 rounded-full bg-accent text-surface-900 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          title="Voice/text input"
          data-testid="expand-button"
        >
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        </button>
      </div>
    );
  }

  // Expanded state - Full screen modal
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
      data-testid="mobile-text-input-expanded"
    >
      <div
        className="w-[90%] max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between bg-gray-50">
          <span className="text-sm font-medium text-gray-700">
            Voice Input
          </span>
          <button
            onClick={handleCollapse}
            className="text-sm font-medium px-3 py-1 rounded-full bg-gray-200 text-gray-600"
            data-testid="collapse-button"
          >
            Cancel
          </button>
        </div>

        {/* Textarea - large, high contrast */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Type or speak..."
            className="w-full h-48 p-4 text-lg text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-blue-400 placeholder:text-gray-400"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            data-testid="text-input"
          />
        </div>

        {/* Action buttons */}
        <div className="px-4 pb-4 flex gap-3">
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className={`flex-1 py-3 rounded-xl font-medium text-base transition-colors ${
              text.trim()
                ? 'bg-gray-200 text-gray-800 active:bg-gray-300'
                : 'bg-gray-100 text-gray-400'
            }`}
            data-testid="send-button"
          >
            Send
          </button>
          <button
            onClick={handleSendWithEnter}
            disabled={!text.trim()}
            className={`flex-1 py-3 rounded-xl font-medium text-base transition-colors ${
              text.trim()
                ? 'bg-blue-500 text-white active:bg-blue-600'
                : 'bg-gray-100 text-gray-400'
            }`}
            data-testid="send-enter-button"
          >
            Send + Enter
          </button>
        </div>

        {/* Hint */}
        <div className="px-4 pb-4 text-center text-xs text-gray-500">
          Tap Send + Enter to submit to Claude
        </div>
      </div>
    </div>
  );
}

export default MobileTextInput;
