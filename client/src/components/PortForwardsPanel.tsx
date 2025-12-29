import { Icons } from './common/Icons';
import { usePortForwards } from '../hooks/usePortForwards';
import { toast } from '../store/toastStore';
import type { Instance } from '@cc-orchestrator/shared';

interface PortForwardsPanelProps {
  instance: Instance;
}

export function PortForwardsPanel({ instance }: PortForwardsPanelProps) {
  const { portForwards, closePortForward } = usePortForwards(instance.id);

  // Only show for remote instances
  if (instance.machineType !== 'remote') {
    return null;
  }

  // Don't show if no port forwards
  if (portForwards.length === 0) {
    return null;
  }

  const handleClose = async (portId: string) => {
    try {
      await closePortForward(portId);
      toast.success('Port forward closed');
    } catch {
      toast.error('Failed to close port forward');
    }
  };

  const handleOpenInBrowser = (localPort: number) => {
    window.open(`http://localhost:${localPort}`, '_blank');
  };

  return (
    <div className="border-t border-surface-600 bg-surface-800">
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs text-theme-muted mb-2">
          <Icons.link />
          <span>Port Forwards</span>
        </div>
        <div className="space-y-1">
          {portForwards.map((pf) => (
            <div
              key={pf.id}
              className="flex items-center justify-between gap-2 bg-surface-700 rounded px-2 py-1.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-theme-primary">
                  localhost:{pf.localPort}
                </span>
                <span className="text-xs text-theme-dim">→</span>
                <span className="text-xs font-mono text-theme-muted">
                  :{pf.remotePort}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleOpenInBrowser(pf.localPort)}
                  className="p-1 text-theme-muted hover:text-accent transition-colors"
                  title="Open in browser"
                >
                  <Icons.externalLink />
                </button>
                <button
                  onClick={() => handleClose(pf.id)}
                  className="p-1 text-theme-muted hover:text-red-400 transition-colors"
                  title="Close forward"
                >
                  <Icons.close />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
