import type { UserPreferences } from '@cc-orchestrator/shared';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onPreferencesChange: (prefs: Partial<UserPreferences>) => void;
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
}

const fontSizes = [10, 11, 12, 13, 14, 15, 16, 18, 20, 24];
const fontFamilies = [
  'JetBrains Mono',
  'Fira Code',
  'SF Mono',
  'Monaco',
  'Menlo',
  'Consolas',
];

export function SettingsModal({
  isOpen,
  onClose,
  preferences,
  onPreferencesChange,
  theme,
  onThemeChange,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface-800 rounded-xl border border-surface-600 shadow-2xl max-w-sm w-full mx-4 animate-expand-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <h2 className="text-lg font-semibold text-theme-primary">Settings</h2>
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
        <div className="px-6 py-4 space-y-4">
          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
            Terminal
          </h3>

          {/* Theme Selector */}
          <div className="flex items-center justify-between">
            <span className="text-theme-primary">Theme</span>
            <div className="flex gap-1 bg-surface-700 rounded-lg p-1">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onThemeChange(t)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize
                    ${theme === t
                      ? 'bg-surface-500 text-theme-primary'
                      : 'text-theme-muted hover:text-theme-primary'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="flex items-center justify-between">
            <span className="text-theme-primary">Font Size</span>
            <select
              value={preferences.terminalFontSize}
              onChange={(e) => onPreferencesChange({ terminalFontSize: parseInt(e.target.value) })}
              className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {fontSizes.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>
          </div>

          {/* Font Family */}
          <div className="flex items-center justify-between">
            <span className="text-theme-primary">Font Family</span>
            <select
              value={preferences.terminalFontFamily}
              onChange={(e) => onPreferencesChange({ terminalFontFamily: e.target.value })}
              className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {fontFamilies.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </div>
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
