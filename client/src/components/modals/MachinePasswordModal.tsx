import { useState, useEffect, useCallback } from 'react';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';
import { toast } from '../../store/toastStore';
import { keychainApi } from '../../api/client';

interface MachinePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineId: string;
  machineName: string;
  onPasswordSaved: () => void;
}

/**
 * Modal for managing a remote machine's keychain password.
 * Allows testing, saving, and deleting the password that's stored
 * in the LOCAL keychain for unlocking the REMOTE machine's keychain.
 */
export function MachinePasswordModal({
  isOpen,
  onClose,
  machineId,
  machineName,
  onPasswordSaved,
}: MachinePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasStoredPassword, setHasStoredPassword] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState('');

  // Check if password is already stored when modal opens
  useEffect(() => {
    if (isOpen && machineId) {
      setLoadingStatus(true);
      keychainApi.hasRemotePassword(machineId)
        .then(res => {
          setHasStoredPassword(res.data?.hasPassword ?? false);
        })
        .catch(() => {
          setHasStoredPassword(false);
        })
        .finally(() => {
          setLoadingStatus(false);
        });
    }
  }, [isOpen, machineId]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setError('');
    }
  }, [isOpen]);

  const handleTestAndSave = useCallback(async () => {
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsTesting(true);
    setError('');

    try {
      // First test the password via SSH
      const testResult = await keychainApi.testRemotePassword(machineId, password);

      if (!testResult.data?.valid) {
        setError(testResult.data?.message || 'Invalid password');
        setIsTesting(false);
        return;
      }

      // Password is valid, now save it to local keychain
      await keychainApi.saveRemotePassword(machineId, password);

      setHasStoredPassword(true);
      setPassword('');
      toast.success(`Password saved for ${machineName}`);
      onPasswordSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to test password';
      setError(message);
    } finally {
      setIsTesting(false);
    }
  }, [password, machineId, machineName, onPasswordSaved, onClose]);

  const handleDeletePassword = useCallback(async () => {
    if (!window.confirm(`Delete the saved password for ${machineName}? You will need to re-enter it for keychain unlock.`)) {
      return;
    }

    setIsDeleting(true);
    setError('');

    try {
      await keychainApi.deleteRemotePassword(machineId);
      setHasStoredPassword(false);
      toast.success('Password deleted');
      onPasswordSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete password';
      setError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }, [machineId, machineName, onPasswordSaved]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && password && !isTesting) {
        e.preventDefault();
        handleTestAndSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, password, isTesting, handleTestAndSave]);

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
            <span className="text-frost-3">
              <Icons.lock />
            </span>
            <h2 className="text-sm font-medium text-theme-primary">Keychain Password</h2>
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
          {loadingStatus ? (
            <div className="flex items-center justify-center py-4">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Machine name */}
              <div className="text-center">
                <p className="text-sm font-medium text-theme-primary">{machineName}</p>
                <p className="text-xs text-theme-dim mt-0.5">Remote Machine Keychain</p>
              </div>

              {/* Current status */}
              {hasStoredPassword && (
                <div className="bg-frost-4/10 border border-frost-4/30 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-frost-3 mt-0.5">
                      <Icons.lock />
                    </span>
                    <div className="flex-1">
                      <p className="text-xs text-frost-2 font-medium">
                        Password saved
                      </p>
                      <p className="text-[10px] text-frost-3/70 mt-0.5">
                        Stored securely in your local macOS Keychain
                      </p>
                    </div>
                    <button
                      onClick={handleDeletePassword}
                      disabled={isDeleting}
                      className="px-2 py-1 rounded text-xs text-aurora-1 hover:bg-aurora-1/10 transition-colors disabled:opacity-50"
                      title="Delete saved password"
                    >
                      {isDeleting ? <Spinner size="sm" /> : 'Delete'}
                    </button>
                  </div>
                </div>
              )}

              {/* Divider if password exists */}
              {hasStoredPassword && (
                <div className="flex items-center gap-3 text-[10px] text-theme-dim uppercase">
                  <span className="flex-1 border-t border-surface-600" />
                  <span>update password</span>
                  <span className="flex-1 border-t border-surface-600" />
                </div>
              )}

              <p className="text-xs text-theme-dim">
                Enter the macOS login password for <strong className="text-theme-muted">{machineName}</strong> to enable keychain auto-unlock.
              </p>

              {/* Password input */}
              <div>
                <label className="block text-xs text-theme-dim mb-1.5">macOS Login Password</label>
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
                    Password will be tested via SSH, then stored in your <strong>local</strong> macOS Keychain (protected by Touch ID/login).
                  </span>
                </p>
              </div>
            </>
          )}
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
            onClick={handleTestAndSave}
            disabled={isTesting || !password || loadingStatus}
            className="px-3 py-1.5 rounded text-xs font-medium bg-accent text-surface-900 hover:bg-accent-bright transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isTesting ? (
              <>
                <Spinner size="sm" />
                Testing...
              </>
            ) : (
              <>
                <Icons.lock />
                Test & Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
