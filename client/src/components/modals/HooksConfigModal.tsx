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

  useEffect(() => {
    if (isOpen && instanceId) {
      setLoading(true);
      const orchestratorUrl = `http://${window.location.hostname}:3456`;

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
  }, [isOpen, instanceId]);

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
            <div className="mb-4 p-3 rounded-lg bg-aurora-4/10 border border-aurora-4/30 text-aurora-4 text-sm">
              <p className="font-medium mb-2">Manual Installation Required</p>
              <ul className="list-disc list-inside space-y-1 text-aurora-3">
                {instructions.map((instruction, i) => (
                  <li key={i}>{instruction}</li>
                ))}
              </ul>
            </div>

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

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-surface-600">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
