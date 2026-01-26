import { useState, useEffect, useRef, useCallback } from 'react';
import { Icons } from '../common/Icons';
import { IconButton } from '../common/IconButton';
import { Spinner } from '../common/Spinner';
import { PortSelector } from './PortSelector';
import { usePortsStore } from '../../store/portsStore';
import { isLocalAccess, getTailscaleIp, getLanIp } from '../../config';
import type { DetectedPort } from '@cc-orchestrator/shared';

interface AppPreviewPanelProps {
  instanceId: string;
  className?: string;
  onClose?: () => void;
  showHeader?: boolean;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export function AppPreviewPanel({
  instanceId,
  className = '',
  onClose,
  showHeader = true,
}: AppPreviewPanelProps) {
  const { instancePorts } = usePortsStore();
  const ports = instancePorts[instanceId]?.ports || [];

  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [urlPath, setUrlPath] = useState('/');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Auto-select first port when ports change
  useEffect(() => {
    if (ports.length > 0 && selectedPort === null) {
      setSelectedPort(ports[0].port);
    } else if (ports.length > 0 && !ports.find((p) => p.port === selectedPort)) {
      // Selected port no longer available, switch to first
      setSelectedPort(ports[0].port);
    }
  }, [ports, selectedPort]);

  // Build the full URL based on context
  const buildUrl = useCallback((port: number, path: string): string => {
    const isLocal = isLocalAccess();

    if (isLocal) {
      // On localhost, use localhost
      return `http://localhost:${port}${path}`;
    }

    // On mobile/remote, need to use server's network IP
    const portInfo = ports.find((p) => p.port === port);

    // Check if port is accessible from outside (bound to 0.0.0.0)
    if (!portInfo?.isAccessible) {
      // Port is localhost-only, still try but will likely fail
      return `http://localhost:${port}${path}`;
    }

    // Try Tailscale first, then LAN IP
    const tailscaleIp = getTailscaleIp();
    if (tailscaleIp) {
      return `http://${tailscaleIp}:${port}${path}`;
    }

    const lanIp = getLanIp();
    if (lanIp) {
      return `http://${lanIp}:${port}${path}`;
    }

    // Fallback to localhost (will fail on mobile but that's expected)
    return `http://localhost:${port}${path}`;
  }, [ports]);

  const currentUrl = selectedPort ? buildUrl(selectedPort, urlPath) : null;

  const handleRefresh = () => {
    if (iframeRef.current && currentUrl) {
      setLoadState('loading');
      setErrorMessage(null);
      iframeRef.current.src = currentUrl;
    }
  };

  const handleOpenExternal = () => {
    if (currentUrl) {
      window.open(currentUrl, '_blank');
    }
  };

  const handleIframeLoad = () => {
    setLoadState('loaded');
    setErrorMessage(null);
  };

  const handleIframeError = () => {
    setLoadState('error');
    setErrorMessage('Failed to load. The app may block embedding (X-Frame-Options) or require HTTPS.');
  };

  const handlePathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let path = e.target.value;
    // Ensure path starts with /
    if (path && !path.startsWith('/')) {
      path = '/' + path;
    }
    setUrlPath(path || '/');
  };

  const handlePathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRefresh();
    }
  };

  // No ports detected
  if (ports.length === 0) {
    return (
      <div className={`flex flex-col bg-surface-800 ${className}`}>
        {showHeader && (
          <div className="flex items-center justify-between px-3 py-2 border-b border-surface-600">
            <div className="flex items-center gap-2">
              <Icons.externalLink />
              <span className="text-sm font-medium text-theme-primary">App Preview</span>
            </div>
            {onClose && (
              <IconButton onClick={onClose} variant="compact" title="Close preview">
                <Icons.close />
              </IconButton>
            )}
          </div>
        )}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-theme-muted">
            <div className="mb-3 opacity-50">
              <Icons.link />
            </div>
            <p className="text-sm font-medium mb-1">No apps detected</p>
            <p className="text-xs opacity-75">
              Start a dev server (Vite, Next.js, etc.) to preview it here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-surface-800 ${className}`}>
      {/* Header with URL bar */}
      {showHeader && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-600">
          {/* Port selector */}
          <PortSelector
            ports={ports}
            selectedPort={selectedPort}
            onSelectPort={setSelectedPort}
          />

          {/* Path input */}
          <div className="flex-1 flex items-center bg-surface-700 rounded-lg overflow-hidden">
            <input
              type="text"
              value={urlPath}
              onChange={handlePathChange}
              onKeyDown={handlePathKeyDown}
              placeholder="/"
              className="flex-1 px-3 py-2 bg-transparent text-sm text-theme-primary placeholder:text-theme-dim focus:outline-none font-mono"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center">
            <IconButton
              onClick={handleRefresh}
              variant="compact"
              title="Refresh"
              disabled={!selectedPort}
            >
              <Icons.refresh />
            </IconButton>
            <IconButton
              onClick={handleOpenExternal}
              variant="compact"
              title="Open in browser"
              disabled={!selectedPort}
            >
              <Icons.externalLink />
            </IconButton>
            {onClose && (
              <IconButton onClick={onClose} variant="compact" title="Close preview">
                <Icons.close />
              </IconButton>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 relative bg-surface-900">
        {loadState === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-900/80 z-10">
            <Spinner size="lg" className="text-accent" />
          </div>
        )}

        {loadState === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-900 z-10">
            <div className="text-center p-6 max-w-sm">
              <div className="text-state-error mb-3">
                <Icons.close />
              </div>
              <p className="text-sm text-theme-primary font-medium mb-2">Cannot embed this app</p>
              <p className="text-xs text-theme-muted mb-4">{errorMessage}</p>
              <button
                onClick={handleOpenExternal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-frost-4/20 text-frost-3 rounded-lg hover:bg-frost-4/30 transition-colors text-sm"
              >
                <Icons.externalLink />
                Open in browser
              </button>
            </div>
          </div>
        )}

        {currentUrl && (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="w-full h-full border-0"
            title="App Preview"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}

        {!currentUrl && loadState === 'idle' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-theme-muted">
              <p className="text-sm">Select a port to preview</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile warning for localhost-only ports */}
      {!isLocalAccess() && selectedPort && (
        <LocalhostWarning port={ports.find((p) => p.port === selectedPort)} />
      )}
    </div>
  );
}

// Warning shown when accessing localhost-only port from mobile
function LocalhostWarning({ port }: { port?: DetectedPort }) {
  if (!port || port.isAccessible) return null;

  return (
    <div className="px-3 py-2 bg-aurora-4/10 border-t border-aurora-4/20">
      <p className="text-xs text-aurora-3">
        <strong>Port {port.port}</strong> is bound to localhost only.
        Run with <code className="bg-surface-700 px-1 rounded">--host 0.0.0.0</code> for mobile access.
      </p>
    </div>
  );
}
