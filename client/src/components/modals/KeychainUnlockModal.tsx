import { useEffect, useState, useCallback } from 'react';
import { Icons } from '../common/Icons';
import { toast } from '../../store/toastStore';
import { instancesApi } from '../../api/client';

interface KeychainUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string | null;
}

/**
 * Secure modal for unlocking the macOS Keychain on a REMOTE machine.
 * Sends the unlock command through the SSH terminal session.
 *
 * Security features:
 * - Password input (no speech-to-text exposure)
 * - Password not stored/cached
 * - Password sent through terminal (not echoed due to password prompt)
 */
export function KeychainUnlockModal({ isOpen, onClose, instanceId }: KeychainUnlockModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState('');

  // Reset form when opening/closing
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setError('');
    }
  }, [isOpen]);

  const handleUnlock = useCallback(async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    if (!instanceId) {
      setError('No remote instance selected');
      return;
    }

    setIsUnlocking(true);
    setError('');

    try {
      // Send the unlock command to the remote terminal
      const unlockCommand = 'security unlock-keychain ~/Library/Keychains/login.keychain-db\n';
      await instancesApi.sendInput(instanceId, unlockCommand);

      // Wait for the password prompt to appear
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send the password (won't be echoed because it's a password prompt)
      await instancesApi.sendInput(instanceId, password + '\n');

      toast.success('Keychain unlock command sent - check terminal for result');
      onClose();
    } catch (err) {
      setError('Failed to send unlock command. Check your connection.');
    } finally {
      setIsUnlocking(false);
    }
  }, [password, instanceId, onClose]);

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
            <h2 className="text-sm font-medium text-theme-primary">Unlock Remote Keychain</h2>
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
            Enter the macOS login password for the <strong>remote machine</strong> to unlock its keychain.
            This allows commands like <code className="bg-surface-800 px-1 rounded">claude</code> to access stored credentials.
          </p>

          {/* Password input */}
          <div>
            <label className="block text-xs text-theme-dim mb-1.5">Remote Keychain Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter remote machine's password"
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
                Password is sent through the SSH terminal session and won't be echoed or stored.
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
            disabled={isUnlocking || !password || !instanceId}
            className="px-3 py-1.5 rounded text-xs font-medium bg-accent text-surface-900 hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isUnlocking ? (
              <>
                <span className="animate-spin">
                  <Icons.loading />
                </span>
                Sending...
              </>
            ) : (
              <>
                <Icons.unlock />
                Unlock
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
