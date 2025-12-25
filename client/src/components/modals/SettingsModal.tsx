import { useEffect, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { settingsApi } from '../../api/client';
import { toast } from '../../store/toastStore';
import { Icons } from '../common/Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, terminalFontSize, terminalFontFamily, setTheme, setTerminalFontSize, setTerminalFontFamily } =
    useSettingsStore();
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Reset confirmation state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setResetConfirmation('');
    }
  }, [isOpen]);

  const handleResetDatabase = async () => {
    if (resetConfirmation !== 'RESET') return;

    setIsResetting(true);
    try {
      await settingsApi.resetDatabase();
      toast.success('Database reset complete');
      // Reload the page to clear all state
      window.location.reload();
    } catch {
      toast.error('Failed to reset database');
      setIsResetting(false);
    }
  };

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
        className="bg-surface-700 rounded-xl shadow-2xl max-w-sm w-full mx-4 animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
          <h2 className="text-lg font-semibold text-theme-primary">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            <Icons.close />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Appearance</h3>

          {/* Theme Selector */}
          <div className="flex items-center justify-between">
            <span className="text-theme-primary">Theme</span>
            <div className="flex gap-1 bg-surface-800 rounded-lg p-1">
              {(['light', 'dark', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors capitalize
                    ${theme === t ? 'bg-surface-500 text-theme-primary' : 'text-theme-muted hover:text-theme-primary'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider pt-2">Terminal</h3>

          {/* Font Size */}
          <div className="flex items-center justify-between">
            <span className="text-theme-primary">Font Size</span>
            <select
              value={terminalFontSize}
              onChange={(e) => setTerminalFontSize(parseInt(e.target.value))}
              className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {[10, 11, 12, 13, 14, 15, 16, 18, 20, 24].map((size) => (
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
              value={terminalFontFamily}
              onChange={(e) => setTerminalFontFamily(e.target.value)}
              className="bg-surface-800 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="JetBrains Mono">JetBrains Mono</option>
              <option value="Fira Code">Fira Code</option>
              <option value="SF Mono">SF Mono</option>
              <option value="Monaco">Monaco</option>
              <option value="Menlo">Menlo</option>
            </select>
          </div>

          {/* Danger Zone */}
          <div className="pt-4 mt-4 border-t border-surface-600">
            <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">Danger Zone</h3>
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-sm text-theme-muted mb-3">
                Reset the database to clear all instances, sessions, and settings. This action cannot be undone.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={resetConfirmation}
                  onChange={(e) => setResetConfirmation(e.target.value)}
                  placeholder='Type "RESET" to confirm'
                  className="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-red-500/50"
                />
                <button
                  onClick={handleResetDatabase}
                  disabled={resetConfirmation !== 'RESET' || isResetting}
                  className="px-4 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm font-medium border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? 'Resetting...' : 'Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-600 flex items-center justify-between">
          <span className="text-xs text-theme-muted">v{__APP_VERSION__}</span>
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
