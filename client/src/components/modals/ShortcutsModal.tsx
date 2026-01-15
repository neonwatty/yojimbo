import { useEffect } from 'react';
import { Icons } from '../common/Icons';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  {
    category: 'Quick Actions',
    items: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['⌘', 'N'], description: 'Create new instance' },
      { keys: ['⌘', '/'], description: 'Show keyboard shortcuts' },
      { keys: ['⌘', ','], description: 'Open settings' },
    ],
  },
  {
    category: 'Navigation',
    items: [
      { keys: ['G', 'H'], description: 'Go to Home' },
      { keys: ['G', 'I'], description: 'Go to Instances' },
      { keys: ['G', 'S'], description: 'Go to History' },
      { keys: ['⌘', '1-9'], description: 'Switch to instance by position' },
      { keys: ['⌘', '['], description: 'Previous instance' },
      { keys: ['⌘', ']'], description: 'Next instance' },
      { keys: ['Esc'], description: 'Return to overview / Close modal' },
    ],
  },
  {
    category: 'Instance Actions',
    items: [
      { keys: ['⌘', 'W'], description: 'Close current instance' },
      { keys: ['⌘', 'P'], description: 'Toggle pin' },
      { keys: ['F2'], description: 'Rename instance' },
    ],
  },
  {
    category: 'Panels',
    items: [
      { keys: ['⌘', 'B'], description: 'Toggle sessions sidebar' },
      // Plans and Mockups hidden - uncomment to restore
      // { keys: ['⌘', 'E'], description: 'Toggle plans panel' },
      // { keys: ['⌘', 'M'], description: 'Toggle mockups panel' },
      { keys: ['⌘', '`'], description: 'Toggle terminal panel' },
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
