interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['⌘', '1-9'], description: 'Switch to instance by number' },
      { keys: ['⌘', '['], description: 'Previous instance' },
      { keys: ['⌘', ']'], description: 'Next instance' },
      { keys: ['⌘', 'B'], description: 'Toggle sidebar' },
    ],
  },
  {
    title: 'Instance Management',
    shortcuts: [
      { keys: ['⌘', 'N'], description: 'New instance' },
      { keys: ['⌘', 'W'], description: 'Close instance' },
      { keys: ['Enter'], description: 'Enter focus mode' },
      { keys: ['Esc'], description: 'Exit focus mode' },
      { keys: ['⌘', 'E'], description: 'Toggle plans panel (focus mode)' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['⌘', ','], description: 'Open settings' },
      { keys: ['⌘', '?'], description: 'Show keyboard shortcuts' },
    ],
  },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface-800 rounded-xl border border-surface-600 shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden animate-expand-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <h2 className="text-lg font-semibold text-theme-primary">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider mb-3">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-theme-secondary">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, index) => (
                        <span key={index}>
                          <kbd className="px-2 py-1 bg-surface-700 border border-surface-500 rounded text-xs font-mono text-theme-primary">
                            {key}
                          </kbd>
                          {index < shortcut.keys.length - 1 && (
                            <span className="text-theme-muted mx-0.5">+</span>
                          )}
                        </span>
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
            <kbd className="px-1.5 py-0.5 bg-surface-700 border border-surface-500 rounded text-xs font-mono">
              Esc
            </kbd>{' '}
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
