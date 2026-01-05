import { useState, useEffect } from 'react';
import { instancesApi } from '../../api/client';
import { Icons } from '../common/Icons';
import { toast } from '../../store/toastStore';

interface HooksConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  instanceName: string;
}

export function HooksConfigModal({ isOpen, onClose, instanceId, instanceName }: HooksConfigModalProps) {
  const [loading, setLoading] = useState(true);
  const [configJson, setConfigJson] = useState('');
  const [instructions, setInstructions] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [checkingHooks, setCheckingHooks] = useState(false);
  const [existingHooks, setExistingHooks] = useState<string[]>([]);
  const [showWarning, setShowWarning] = useState(false);

  // Compute orchestrator URL once
  const orchestratorUrl = `http://${window.location.hostname}:3456`;

  useEffect(() => {
    if (isOpen && instanceId) {
      setLoading(true);
      setInstalled(false);

      instancesApi.getHooksConfig(instanceId, orchestratorUrl)
        .then((res) => {
          if (res.data) {
            setConfigJson(res.data.configJson);
            setInstructions(res.data.instructions);
          }
        })
        .catch((err) => {
          console.error('Failed to get hooks config:', err);
          toast.error('Failed to load hooks configuration');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, instanceId, orchestratorUrl]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(configJson);
      setCopied(true);
      toast.success('Configuration copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Check for existing hooks before installing
  const handleInstallClick = async () => {
    setCheckingHooks(true);
    try {
      const res = await instancesApi.checkHooks(instanceId);
      if (res.success && res.data && res.data.existingHooks.length > 0) {
        setExistingHooks(res.data.existingHooks);
        setShowWarning(true);
      } else {
        // No existing hooks, proceed directly
        await doInstall();
      }
    } catch (err) {
      console.error('Failed to check existing hooks:', err);
      // On error, just proceed with install (backup will be created anyway)
      await doInstall();
    } finally {
      setCheckingHooks(false);
    }
  };

  // Actually perform the installation
  const doInstall = async () => {
    setShowWarning(false);
    setInstalling(true);
    try {
      const res = await instancesApi.installHooks(instanceId, orchestratorUrl);
      if (res.success && res.data) {
        setInstalled(true);
        toast.success('Hooks installed successfully');
        if (res.data.tunnelActive) {
          toast.success('Reverse tunnel established - status tracking enabled');
        } else if (res.data.tunnelError) {
          toast.warning(`Hooks installed but tunnel failed: ${res.data.tunnelError}`);
        }
      } else {
        toast.error(res.error || 'Failed to install hooks');
      }
    } catch (err) {
      console.error('Failed to install hooks:', err);
      toast.error('Failed to install hooks');
    } finally {
      setInstalling(false);
    }
  };

  const handleCancelWarning = () => {
    setShowWarning(false);
    setExistingHooks([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-700 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
            <Icons.settings />
            Hooks Configuration for {instanceName}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-600 text-theme-dim hover:text-theme-primary transition-colors"
          >
            <Icons.close />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/30 text-accent text-sm">
              <p className="font-medium mb-2">
                {installed ? '✓ Hooks Installed' : 'Click "Install Hooks" to set up automatically'}
              </p>
              <p className="text-theme-muted text-xs">
                This will SSH to the remote machine, install the hooks configuration, and establish a reverse tunnel for status tracking.
              </p>
            </div>

            <details className="mb-4">
              <summary className="cursor-pointer text-xs text-theme-dim hover:text-theme-muted">
                Manual installation instructions (advanced)
              </summary>
              <div className="mt-2 p-3 rounded-lg bg-surface-800 border border-surface-600 text-sm">
                <ul className="list-disc list-inside space-y-1 text-theme-muted">
                  {instructions.map((instruction, i) => (
                    <li key={i}>{instruction}</li>
                  ))}
                </ul>
              </div>
            </details>

            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-theme-dim font-mono">~/.claude/settings.json</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-surface-600 hover:bg-surface-500 text-theme-primary transition-colors"
                >
                  {copied ? (
                    <>
                      <Icons.check />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Icons.copy />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <div className="flex-1 overflow-auto rounded-lg bg-surface-900 border border-surface-600">
                <pre className="p-4 text-xs font-mono text-theme-muted whitespace-pre overflow-x-auto">
                  {configJson}
                </pre>
              </div>
            </div>

            {/* Warning dialog for existing hooks */}
            {showWarning && (
              <div className="mb-4 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-start gap-2 text-yellow-400 mb-3">
                  <span className="text-lg">⚠️</span>
                  <div>
                    <p className="font-medium">Existing hooks will be overwritten</p>
                    <p className="text-sm text-yellow-400/80 mt-1">
                      The following hook types already exist on the remote machine:
                    </p>
                  </div>
                </div>
                <ul className="list-disc list-inside text-sm text-theme-muted mb-3 ml-6">
                  {existingHooks.map((hook) => (
                    <li key={hook} className="font-mono">{hook}</li>
                  ))}
                </ul>
                <p className="text-xs text-theme-dim mb-3">
                  A backup will be saved to ~/.claude/settings.json.backup.* before installation.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleCancelWarning}
                    className="px-3 py-1.5 rounded text-sm text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={doInstall}
                    className="px-3 py-1.5 rounded text-sm bg-yellow-600 hover:bg-yellow-500 text-white font-medium transition-colors"
                  >
                    Install Anyway
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-surface-600">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleInstallClick}
                disabled={installing || installed || checkingHooks || showWarning}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent/80 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {checkingHooks ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Checking...
                  </>
                ) : installing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Installing...
                  </>
                ) : installed ? (
                  <>
                    <Icons.check />
                    Installed
                  </>
                ) : (
                  'Install Hooks'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
