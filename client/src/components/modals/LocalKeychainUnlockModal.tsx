import { useEffect, useState, useCallback } from 'react';
import { Icons } from '../common/Icons';
import { toast } from '../../store/toastStore';
import { keychainApi } from '../../api/client';

interface LocalKeychainUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage?: string;
}

/**
 * Modal for unlocking the LOCAL macOS Keychain.
 * Shown when server startup auto-unlock fails.
 *
 * Security features:
 * - Password input (no speech-to-text exposure)
 * - Option to save password for future auto-unlock
 */
export function LocalKeychainUnlockModal({ isOpen, onClose, errorMessage }: LocalKeychainUnlockModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savePassword, setSavePassword] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');

  // Reset form when opening/closing
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setSavePassword(true);
      setError(errorMessage || '');
    }
  }, [isOpen, errorMessage]);

  const handleUnlock = useCallback(async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsUnlocking(true);
    setError('');

    try {
      // Unlock the keychain
      await keychainApi.unlock(password);

      // If save is checked, save the password for future auto-unlock
      if (savePassword) {
        try {
          await keychainApi.saveLocalPassword(password);
          toast.success('Keychain unlocked and password saved for auto-unlock');
        } catch {
          // Don't fail if save fails
          toast.success('Keychain unlocked (password save failed)');
        }
      } else {
        toast.success('Keychain unlocked');
      }

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlock keychain';
      setError(message);
    } finally {
      setIsUnlocking(false);
    }
  }, [password, savePassword, onClose]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && password && !isUnlocking) {
        e.preventDefault();
        handleUnlock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, password, isUnlocking, handleUnlock]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface-700 rounded-xl shadow-2xl max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-600">
          <div className="flex items-center gap-2">
            <span className="text-aurora-4">
              <Icons.unlock />
            </span>
            <h2 className="text-sm font-medium text-theme-primary">Unlock Local Keychain</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-theme-dim hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            <Icons.close />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-4">
          <p className="text-xs text-theme-dim">
            Enter your macOS login password to unlock the keychain. This allows Claude Code to access stored credentials.
          </p>

          {/* Password input */}
          <div>
            <label className="block text-xs text-theme-dim mb-1.5">macOS Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter your macOS password"
                autoComplete="current-password"
                autoFocus
                className="w-full bg-surface-800 border border-surface-600 rounded px-3 py-2.5 text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-1 focus:ring-frost-4/50 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-dim hover:text-theme-primary transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <Icons.eyeOff /> : <Icons.eye />}
              </button>
            </div>
          </div>

          {/* Save password checkbox */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={savePassword}
              onChange={(e) => setSavePassword(e.target.checked)}
              className="w-4 h-4 rounded border-surface-500 bg-surface-800 text-frost-4 focus:ring-frost-4/50"
            />
            <span className="text-xs text-theme-dim group-hover:text-theme-secondary transition-colors">
              Save for auto-unlock on server startup
            </span>
          </label>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-aurora-1">
              <Icons.alertCircle />
              <span>{error}</span>
            </div>
          )}

          {/* Security note */}
          <div className="bg-surface-800/50 border border-surface-600 rounded p-2.5 text-[10px] text-theme-dim">
            <p className="flex items-start gap-2">
              <Icons.lock />
              <span>
                {savePassword
                  ? 'Password will be stored in macOS Keychain (protected by Touch ID/login).'
                  : 'Password will only be used for this unlock and not saved.'}
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-surface-600 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs font-medium text-theme-dim hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUnlock}
            disabled={isUnlocking || !password}
            className="px-3 py-1.5 rounded text-xs font-medium bg-accent text-surface-900 hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isUnlocking ? (
              <>
                <span className="animate-spin">
                  <Icons.loading />
                </span>
                Unlocking...
              </>
            ) : (
              <>
                <Icons.unlock />
                {savePassword ? 'Save & Unlock' : 'Unlock'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
