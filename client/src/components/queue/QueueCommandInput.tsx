import { useState, useRef, useEffect } from 'react';
import { Icons } from '../common/Icons';

interface QueueCommandInputProps {
  onSubmit: (command: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function QueueCommandInput({
  onSubmit,
  placeholder = 'Enter command...',
  disabled = false,
  autoFocus = true,
}: QueueCommandInputProps) {
  const [command, setCommand] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim() && !disabled) {
      onSubmit(command.trim());
      setCommand('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-dim font-mono text-sm">
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full pl-7 pr-3 py-2 bg-surface-800 border border-surface-600 rounded-lg
            font-mono text-sm text-theme-primary placeholder:text-theme-dim
            focus:outline-none focus:ring-1 focus:ring-frost-4 focus:border-frost-4
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        />
      </div>
      <button
        type="submit"
        disabled={!command.trim() || disabled}
        className={`
          p-2 rounded-lg transition-colors
          ${
            command.trim() && !disabled
              ? 'bg-frost-4 text-white hover:bg-frost-3'
              : 'bg-surface-600 text-theme-dim cursor-not-allowed'
          }
        `}
        title="Send command"
      >
        <Icons.send />
      </button>
    </form>
  );
}
