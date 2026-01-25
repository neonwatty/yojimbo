import { useEffect, useState, useCallback } from 'react';
import { Icons } from '../common/Icons';
import { toast } from '../../store/toastStore';
import { instancesApi, keychainApi } from '../../api/client';

interface KeychainUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string | null;
  machineId?: string | null;
}

/**
 * Secure modal for unlocking the macOS Keychain on a REMOTE machine.
 * Sends the unlock command through the SSH terminal session.
 *
 * Security features:
 * - Password input (no speech-to-text exposure)
 * - Option to save password securely in LOCAL macOS Keychain
 * - Auto-unlock using saved password
 */
export function KeychainUnlockModal({ isOpen, onClose, instanceId, machineId }: KeychainUnlockModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savePassword, setSavePassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [error, setError] = useState('');

  // Check if password is already stored
  useEffect(() => {
    if (isOpen && machineId) {
      keychainApi.hasRemotePassword(machineId)
        .then(res => {
          setHasStoredPassword(res.data?.hasPassword ?? false);
        })
        .catch(() => {
          setHasStoredPassword(false);
        });
    }
  }, [isOpen, machineId]);

  // Reset form when opening/closing
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setSavePassword(false);
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
      // If save is checked and machineId exists, save the password first
      if (savePassword && machineId) {
        setIsSaving(true);
        try {
          await keychainApi.saveRemotePassword(machineId, password);
          setHasStoredPassword(true);
          toast.success('Password saved securely to local keychain');
        } catch {
          // Don't fail the unlock if save fails, just warn
          toast.error('Failed to save password, but proceeding with unlock');
        }
        setIsSaving(false);
      }

      // Send the unlock command to the remote terminal
      const unlockCommand = 'security unlock-keychain ~/Library/Keychains/login.keychain-db\n';
      await instancesApi.sendInput(instanceId, unlockCommand);

      // Wait for the password prompt to appear
      // Use 1500ms delay to account for SSH latency (was 500ms which was too fast)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Send the password (won't be echoed because it's a password prompt)
      await instancesApi.sendInput(instanceId, password + '\n');

      toast.success('Keychain unlock command sent - check terminal for result');
      onClose();
    } catch (err) {
      setError('Failed to send unlock command. Check your connection.');
    } finally {
      setIsUnlocking(false);
    }
  }, [password, instanceId, machineId, savePassword, onClose]);

  const handleAutoUnlock = useCallback(async () => {
    if (!instanceId) {
      setError('No remote instance selected');
      return;
    }

    setIsUnlocking(true);
    setError('');

    try {
      await keychainApi.autoUnlockRemote(instanceId);
      toast.success('Keychain unlock command sent - check terminal for result');
      onClose();
    } catch (err) {
      setError('Failed to auto-unlock. Password may need to be re-saved.');
    } finally {
      setIsUnlocking(false);
    }
  }, [instanceId, onClose]);

  const handleDeleteSavedPassword = useCallback(async () => {
    if (!machineId) return;

    try {
      await keychainApi.deleteRemotePassword(machineId);
      setHasStoredPassword(false);
      toast.success('Saved password deleted');
    } catch {
      toast.error('Failed to delete saved password');
    }
  }, [machineId]);

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
          {/* Auto-unlock option if password is saved */}
          {hasStoredPassword && (
            <div className="bg-frost-4/10 border border-frost-4/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-frost-3 mt-0.5">
                  <Icons.lock />
                </span>
                <div className="flex-1">
                  <p className="text-xs text-frost-2 font-medium mb-2">
                    Password saved in local keychain
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAutoUnlock}
                      disabled={isUnlocking}
                      className="px-2.5 py-1 rounded text-xs font-medium bg-frost-4 text-surface-900 hover:bg-frost-3 transition-colors disabled:opacity-50"
                    >
                      {isUnlocking ? 'Unlocking...' : 'Auto-Unlock'}
                    </button>
                    <button
                      onClick={handleDeleteSavedPassword}
                      className="px-2 py-1 rounded text-xs text-aurora-1 hover:bg-aurora-1/10 transition-colors"
                      title="Delete saved password"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Divider if both options available */}
          {hasStoredPassword && (
            <div className="flex items-center gap-3 text-[10px] text-theme-dim uppercase">
              <span className="flex-1 border-t border-surface-600" />
              <span>or enter manually</span>
              <span className="flex-1 border-t border-surface-600" />
            </div>
          )}

          <p className="text-xs text-theme-dim">
            Enter the macOS login password for the <strong>remote machine</strong> to unlock its keychain.
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
                autoFocus={!hasStoredPassword}
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
          {machineId && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={savePassword}
                onChange={(e) => setSavePassword(e.target.checked)}
                className="w-4 h-4 rounded border-surface-500 bg-surface-800 text-frost-4 focus:ring-frost-4/50"
              />
              <span className="text-xs text-theme-dim group-hover:text-theme-secondary transition-colors">
                Save password securely in local keychain
              </span>
            </label>
          )}

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
                  ? 'Password will be stored in your local macOS Keychain (protected by Touch ID/login).'
                  : 'Password is sent through the SSH terminal session and won\'t be echoed.'}
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
            disabled={isUnlocking || isSaving || !password || !instanceId}
            className="px-3 py-1.5 rounded text-xs font-medium bg-accent text-surface-900 hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isUnlocking || isSaving ? (
              <>
                <span className="animate-spin">
                  <Icons.loading />
                </span>
                {isSaving ? 'Saving...' : 'Sending...'}
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
