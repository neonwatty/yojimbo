import { useEffect, useCallback, useState } from 'react';
import { usePortsStore } from '../../store/portsStore';
import { instancesApi } from '../../api/client';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';
import { toast } from '../../store/toastStore';
import type { InstancePorts, DetectedPort } from '@cc-orchestrator/shared';

interface PortsPanelProps {
  instanceId: string;
  isOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

const WS_URL = `ws://${window.location.hostname}:${import.meta.env.VITE_API_PORT || '3456'}/ws`;

export function PortsPanel({ instanceId, isOpen, onClose, width, onWidthChange }: PortsPanelProps) {
  const { instancePorts, setInstancePorts } = usePortsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { subscribe } = useWebSocket(WS_URL);

  const ports = instancePorts[instanceId];

  // Fetch ports on mount and when panel opens
  const fetchPorts = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const response = await instancesApi.getListeningPorts(instanceId, refresh);
      if (response.data) {
        setInstancePorts(instanceId, response.data);
      }
    } catch {
      // Error toast handled by API layer
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [instanceId, setInstancePorts]);

  useEffect(() => {
    if (isOpen) {
      fetchPorts();
    }
  }, [isOpen, fetchPorts]);

  // Subscribe to WebSocket updates
  useEffect(() => {
    const unsubscribe = subscribe('ports:updated', (data: unknown) => {
      const update = data as { instanceId: string; instancePorts: InstancePorts };
      if (update.instanceId === instanceId) {
        setInstancePorts(instanceId, update.instancePorts);
      }
    });

    return unsubscribe;
  }, [instanceId, subscribe, setInstancePorts]);

  // Panel resize handling
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX;
      const newWidth = Math.min(Math.max(startWidth + delta, 280), 600);
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Copied to clipboard');
  };

  const getTailscaleUrl = (port: number): string | null => {
    if (ports?.tailscaleIp) {
      return `http://${ports.tailscaleIp}:${port}`;
    }
    return null;
  };

  if (!isOpen) return null;

  const detectedPorts = ports?.ports || [];
  const hasAccessiblePorts = detectedPorts.some(p => p.isAccessible);
  const hasTailscale = !!ports?.tailscaleIp;

  return (
    <div className="flex flex-shrink-0 h-full" style={{ width }}>
      {/* Resize handle */}
      <div
        className="w-1 bg-surface-600 hover:bg-accent cursor-col-resize flex-shrink-0"
        onMouseDown={handleResizeStart}
      />

      <div className="flex-1 flex flex-col bg-surface-800 border-l border-surface-600 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-surface-600 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
            <Icons.link />
            <span className="text-sm font-semibold text-theme-primary flex-shrink-0">Ports</span>
            {(isLoading || isRefreshing) && <Spinner size="sm" className="text-accent flex-shrink-0" />}
            {!isLoading && detectedPorts.length > 0 && (
              <span className="text-xs text-theme-muted font-normal">
                {detectedPorts.length} listening
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchPorts(true)}
              disabled={isRefreshing}
              className="p-1.5 rounded hover:bg-surface-700 text-theme-muted hover:text-theme-primary transition-colors disabled:opacity-50"
              title="Refresh ports"
            >
              <Icons.refresh />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-surface-700 text-theme-muted hover:text-theme-primary transition-colors"
              title="Close panel"
            >
              <Icons.close />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Spinner size="md" className="text-accent" />
            </div>
          ) : detectedPorts.length === 0 ? (
            <div className="p-4 text-center text-theme-muted">
              <div className="opacity-50 mb-2">
                <Icons.link />
              </div>
              <p className="text-sm font-medium mb-1">No ports detected</p>
              <p className="text-xs opacity-75 mb-4">
                Start a dev server (Vite, Next.js, etc.) to see it here
              </p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {/* Tailscale status */}
              {hasTailscale ? (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-frost-4/10 rounded text-xs text-frost-3 mb-3">
                  <Icons.wifi />
                  <span>Tailscale: {ports?.tailscaleIp}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-2 py-1.5 bg-surface-700 rounded text-xs text-theme-muted mb-3">
                  <Icons.wifi />
                  <span>Tailscale not connected</span>
                </div>
              )}

              {/* Port list */}
              {detectedPorts.map((port) => (
                <PortItem
                  key={port.port}
                  port={port}
                  tailscaleUrl={getTailscaleUrl(port.port)}
                  onCopy={handleCopyUrl}
                />
              ))}

              {/* Instructions for localhost-only ports */}
              {!hasAccessiblePorts && detectedPorts.length > 0 && (
                <div className="mt-4 p-3 bg-aurora-4/10 rounded border border-aurora-4/20">
                  <p className="text-xs text-aurora-3 font-medium mb-1">
                    Ports bound to localhost only
                  </p>
                  <p className="text-xs text-aurora-4/80">
                    To access via Tailscale, run your dev server with --host 0.0.0.0 or --host flag.
                    For example: <code className="bg-surface-700 px-1 rounded">vite --host</code>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface PortItemProps {
  port: DetectedPort;
  tailscaleUrl: string | null;
  onCopy: (url: string) => void;
}

function PortItem({ port, tailscaleUrl, onCopy }: PortItemProps) {
  const localhostUrl = `http://localhost:${port.port}`;

  return (
    <div className="bg-surface-700 rounded p-2">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono font-medium text-theme-primary">
            :{port.port}
          </span>
          {port.processName && (
            <span className="text-xs text-theme-muted">
              {port.processName}
            </span>
          )}
        </div>
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            port.isAccessible
              ? 'bg-frost-4/20 text-frost-3'
              : 'bg-surface-600 text-theme-muted'
          }`}
        >
          {port.bindAddress}
        </span>
      </div>

      {/* URL buttons */}
      <div className="flex items-center gap-2 mt-2">
        {/* Localhost URL */}
        <button
          onClick={() => window.open(localhostUrl, '_blank')}
          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-surface-600 text-theme-secondary hover:bg-surface-500 transition-colors"
        >
          <Icons.externalLink />
          localhost
        </button>
        <button
          onClick={() => onCopy(localhostUrl)}
          className="p-1 text-theme-muted hover:text-theme-primary transition-colors"
          title="Copy localhost URL"
        >
          <Icons.copy />
        </button>

        {/* Tailscale URL (if accessible) */}
        {port.isAccessible && tailscaleUrl && (
          <>
            <span className="text-surface-500">|</span>
            <button
              onClick={() => window.open(tailscaleUrl, '_blank')}
              className="flex items-center gap-1.5 px-2 py-1 text-xs rounded bg-frost-4/20 text-frost-3 hover:bg-frost-4/30 transition-colors"
            >
              <Icons.wifi />
              Tailscale
            </button>
            <button
              onClick={() => onCopy(tailscaleUrl)}
              className="p-1 text-frost-3/70 hover:text-frost-3 transition-colors"
              title="Copy Tailscale URL"
            >
              <Icons.copy />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
