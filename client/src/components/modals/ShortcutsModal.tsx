import { useEffect } from 'react';
import { Icons } from '../common/Icons';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  {
    category: 'Navigation',
    items: [
      { keys: ['⌘', '1-9'], description: 'Switch to instance and expand' },
      { keys: ['⌘', '['], description: 'Previous instance' },
      { keys: ['⌘', ']'], description: 'Next instance' },
    ],
  },
  {
    category: 'Instances',
    items: [
      { keys: ['Enter'], description: 'Expand selected instance' },
      { keys: ['Esc'], description: 'Return to overview / Cancel' },
      { keys: ['F2'], description: 'Rename active instance' },
      { keys: ['⌘', 'W'], description: 'Close active instance' },
    ],
  },
  {
    category: 'Panels',
    items: [
      { keys: ['⌘', 'B'], description: 'Toggle sessions sidebar' },
      { keys: ['⌘', 'E'], description: 'Toggle plans panel' },
      { keys: ['⌘', '`'], description: 'Toggle terminal panel' },
    ],
  },
  {
    category: 'General',
    items: [
      { keys: ['⌘', '?'], description: 'Show keyboard shortcuts' },
      { keys: ['⌘', ','], description: 'Open settings' },
    ],
  },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <h2 className="text-lg font-semibold text-theme-primary">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            <Icons.close />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-auto">
          {shortcuts.map((section, idx) => (
            <div key={section.category} className={idx > 0 ? 'mt-6' : ''}>
              <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
                {section.category}
              </h3>
              <div className="space-y-2">
                {section.items.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-theme-primary">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, k) => (
                        <kbd
                          key={k}
                          className="px-2 py-1 bg-surface-800 border border-surface-500 rounded text-xs font-mono text-theme-muted min-w-[24px] text-center"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-600 text-center">
          <span className="text-xs text-theme-muted">
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-surface-800 border border-surface-500 rounded text-xs font-mono">
              Esc
            </kbd>{' '}
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
