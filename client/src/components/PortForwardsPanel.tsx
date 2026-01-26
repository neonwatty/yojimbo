import { Icons } from './common/Icons';
import { IconButton } from './common/IconButton';
import { Spinner } from './common/Spinner';
import { usePortForwards } from '../hooks/usePortForwards';
import { toast } from '../store/toastStore';
import { isLocalAccess, getRemoteAccessUrl, getLocalhostUrl } from '../config';
import type { Instance, PortForwardStatus } from '@cc-orchestrator/shared';

interface PortForwardsPanelProps {
  instance: Instance;
}

// Status badge styling
const STATUS_STYLES: Record<PortForwardStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-state-working/20', text: 'text-state-working', label: 'Active' },
  reconnecting: { bg: 'bg-state-awaiting/20', text: 'text-state-awaiting', label: 'Reconnecting...' },
  failed: { bg: 'bg-state-error/20', text: 'text-state-error', label: 'Failed' },
  closed: { bg: 'bg-surface-600', text: 'text-theme-muted', label: 'Closed' },
};

export function PortForwardsPanel({ instance }: PortForwardsPanelProps) {
  const { portForwards, closePortForward, reconnectPortForward } = usePortForwards(instance.id);
  const isLocal = isLocalAccess();

  // Only show for remote instances
  if (instance.machineType !== 'remote') {
    return null;
  }

  // Filter out closed forwards, show active/reconnecting/failed
  const visibleForwards = portForwards.filter((pf) => pf.status !== 'closed');

  // Don't show if no port forwards
  if (visibleForwards.length === 0) {
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

  const handleReconnect = async (portId: string) => {
    try {
      await reconnectPortForward(portId);
      toast.success('Reconnecting...');
    } catch {
      toast.error('Failed to reconnect');
    }
  };

  // Get the appropriate URL for a port forward based on client access
  const getPortUrl = (localPort: number): string | null => {
    if (isLocal) {
      // Client is on the same machine as the server - localhost works
      return getLocalhostUrl(localPort);
    }
    // Client is remote (mobile/tablet) - need server's network IP
    return getRemoteAccessUrl(localPort);
  };

  const handleOpenInBrowser = (localPort: number) => {
    const url = getPortUrl(localPort);
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('Cannot access port forwards from this device');
    }
  };

  const handleCopyUrl = (localPort: number) => {
    const url = getPortUrl(localPort);
    if (url) {
      navigator.clipboard.writeText(url);
      toast.success('Copied to clipboard');
    } else {
      toast.error('No accessible URL available');
    }
  };

  // Get display label for the port URL
  const getPortDisplayLabel = (localPort: number): string => {
    if (isLocal) {
      return `localhost:${localPort}`;
    }
    const url = getRemoteAccessUrl(localPort);
    if (url) {
      // Extract host:port from URL
      const match = url.match(/http:\/\/([^/]+)/);
      return match ? match[1] : `port ${localPort}`;
    }
    return `port ${localPort}`;
  };

  return (
    <div className="border-t border-surface-600 bg-surface-800">
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs text-theme-muted mb-2">
          <Icons.link />
          <span>Port Forwards</span>
          {!isLocal && (
            <span className="ml-auto text-frost-3 flex items-center gap-1">
              <Icons.wifi />
              <span className="hidden sm:inline">Remote</span>
            </span>
          )}
        </div>
        <div className="space-y-1">
          {visibleForwards.map((pf) => {
            const url = getPortUrl(pf.localPort);
            const hasUrl = !!url && pf.status === 'active';
            const statusStyle = STATUS_STYLES[pf.status];
            const isReconnecting = pf.status === 'reconnecting';
            const isFailed = pf.status === 'failed';

            return (
              <div
                key={pf.id}
                className={`flex items-center justify-between gap-2 bg-surface-700 rounded px-2 py-1.5 ${
                  isFailed ? 'border border-state-error/30' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isReconnecting && (
                    <Spinner size="sm" className="text-state-awaiting shrink-0" />
                  )}
                  <span className={`text-xs font-mono truncate ${
                    pf.status === 'active' ? 'text-theme-primary' : 'text-theme-muted'
                  }`}>
                    {getPortDisplayLabel(pf.localPort)}
                  </span>
                  <span className="text-xs text-theme-dim shrink-0">→</span>
                  <span className="text-xs font-mono text-theme-muted shrink-0">
                    :{pf.remotePort}
                  </span>
                  {pf.status !== 'active' && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center shrink-0">
                  {hasUrl && (
                    <>
                      <IconButton
                        onClick={() => handleCopyUrl(pf.localPort)}
                        variant="compact"
                        title="Copy URL"
                      >
                        <Icons.copy />
                      </IconButton>
                      <IconButton
                        onClick={() => handleOpenInBrowser(pf.localPort)}
                        color="accent"
                        variant="compact"
                        title="Open in browser"
                      >
                        <Icons.externalLink />
                      </IconButton>
                    </>
                  )}
                  {isFailed && (
                    <IconButton
                      onClick={() => handleReconnect(pf.id)}
                      color="accent"
                      variant="compact"
                      title="Retry connection"
                    >
                      <Icons.refresh />
                    </IconButton>
                  )}
                  <IconButton
                    onClick={() => handleClose(pf.id)}
                    color="danger"
                    variant="compact"
                    title="Close forward"
                    disabled={isReconnecting}
                  >
                    <Icons.close />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
        {!isLocal && !getRemoteAccessUrl(3000) && (
          <div className="mt-2 p-2 bg-aurora-4/10 rounded text-xs text-aurora-3">
            <p>Port forwards require Tailscale or LAN access to the server.</p>
          </div>
        )}
      </div>
    </div>
  );
}
