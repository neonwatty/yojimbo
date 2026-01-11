import { useState, useEffect } from 'react';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';
import { toast } from '../../store/toastStore';
import { keychainApi } from '../../api/client';

/**
 * Settings section for configuring local keychain auto-unlock.
 * Allows saving the macOS login password to enable automatic keychain unlock
 * when the server starts.
 */
export function LocalKeychainSection() {
  const [hasPassword, setHasPassword] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Check if password is saved and keychain status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const [passwordRes, statusRes] = await Promise.all([
          keychainApi.hasLocalPassword(),
          keychainApi.status(),
        ]);
        setHasPassword(passwordRes.data?.hasPassword ?? false);
        setIsLocked(statusRes.data?.locked ?? true);
      } catch {
        // Ignore errors - likely not on macOS
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  const handleSavePassword = async () => {
    if (!password) {
      toast.error('Password is required');
      return;
    }

    setIsSaving(true);
    try {
      // Test the password first
      await keychainApi.testLocalUnlock(password);
      // If test succeeds, save it
      await keychainApi.saveLocalPassword(password);
      setHasPassword(true);
      setIsLocked(false);
      setShowForm(false);
      setPassword('');
      toast.success('Password saved for auto-unlock');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save password';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePassword = async () => {
    if (!window.confirm('Delete saved keychain password? You will need to enter it again for auto-unlock.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await keychainApi.deleteLocalPassword();
      setHasPassword(false);
      toast.success('Password deleted');
    } catch {
      toast.error('Failed to delete password');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestUnlock = async () => {
    setIsTesting(true);
    try {
      const statusRes = await keychainApi.status();
      if (!statusRes.data?.locked) {
        toast.success('Keychain is already unlocked');
        setIsLocked(false);
      } else {
        toast.info('Keychain is locked');
        setIsLocked(true);
      }
    } catch {
      toast.error('Failed to check keychain status');
    } finally {
      setIsTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="pt-4 mt-4 border-t border-surface-600">
        <div className="flex items-center justify-center py-4">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 mt-4 border-t border-surface-600">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
          Local Keychain
        </h3>
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            isLocked
              ? 'bg-aurora-1/20 text-aurora-1'
              : 'bg-aurora-4/20 text-aurora-4'
          }`}>
            {isLocked ? 'Locked' : 'Unlocked'}
          </span>
        </div>
      </div>

      <p className="text-xs text-theme-muted mb-3">
        Save your macOS login password to automatically unlock the keychain when the server starts.
        This allows Claude Code to access stored credentials without manual intervention.
      </p>

      {hasPassword ? (
        <div className="bg-surface-800 border border-surface-600 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-frost-3">
                <Icons.lock />
              </span>
              <div>
                <p className="text-sm text-theme-primary font-medium">Password saved</p>
                <p className="text-xs text-theme-muted">Auto-unlock is enabled</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestUnlock}
                disabled={isTesting}
                className="px-2 py-1 text-xs text-theme-muted hover:text-theme-primary border border-surface-500 hover:border-surface-400 rounded transition-colors disabled:opacity-50"
              >
                {isTesting ? <Spinner size="sm" /> : 'Check Status'}
              </button>
              <button
                onClick={handleDeletePassword}
                disabled={isDeleting}
                className="px-2 py-1 text-xs text-aurora-1 hover:bg-aurora-1/10 rounded transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Spinner size="sm" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : showForm ? (
        <div className="bg-surface-800 border border-surface-600 rounded-lg p-3 space-y-3">
          <div>
            <label className="block text-xs text-theme-dim mb-1.5">macOS Login Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your macOS password"
                autoComplete="current-password"
                autoFocus
                className="w-full bg-surface-700 border border-surface-500 rounded px-3 py-2 text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none focus:ring-1 focus:ring-frost-4/50 pr-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && password) {
                    handleSavePassword();
                  }
                }}
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

          <div className="bg-surface-900/50 border border-surface-600 rounded p-2 text-[10px] text-theme-dim">
            <p className="flex items-start gap-2">
              <Icons.lock />
              <span>
                Password is stored securely in your macOS Keychain, protected by Touch ID or your login password.
              </span>
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowForm(false);
                setPassword('');
              }}
              className="px-2 py-1 text-xs text-theme-muted hover:text-theme-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSavePassword}
              disabled={isSaving || !password}
              className="px-2 py-1 text-xs bg-accent text-white rounded hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isSaving ? (
                <>
                  <Spinner size="sm" />
                  Testing...
                </>
              ) : (
                <>
                  <Icons.lock />
                  Save Password
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-surface-800 border border-surface-600 rounded-lg p-4">
          <div className="text-center">
            <Icons.unlock />
            <p className="text-sm text-theme-muted mt-2">No password saved</p>
            <p className="text-xs text-theme-dim mt-1">
              Auto-unlock is disabled. You may be prompted to unlock the keychain manually.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-accent hover:text-accent/80 transition-colors"
            >
              Set up auto-unlock
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-theme-dim mt-3 px-1">
        <strong>Note:</strong> If auto-unlock fails (e.g., password changed), you'll be prompted to re-enter your password.
      </p>
    </div>
  );
}
