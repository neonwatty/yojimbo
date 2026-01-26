import { useState, useCallback, useEffect } from 'react';
import { AppPreviewPanel } from './AppPreviewPanel';
import { Icons } from '../common/Icons';
import { IconButton } from '../common/IconButton';
import { usePortsStore } from '../../store/portsStore';

interface AppPreviewDrawerProps {
  instanceId: string;
  isOpen: boolean;
  onToggle: () => void;
}

const MIN_HEIGHT = 200;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 300;

export function AppPreviewDrawer({ instanceId, isOpen, onToggle }: AppPreviewDrawerProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const { instancePorts } = usePortsStore();
  const ports = instancePorts[instanceId]?.ports || [];
  const hasPorts = ports.length > 0;

  // Handle resize via drag
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.min(Math.max(startHeight + delta, MIN_HEIGHT), MAX_HEIGHT);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height]);

  // Handle resize via touch
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const startY = e.touches[0].clientY;
    const startHeight = height;

    const handleTouchMove = (e: TouchEvent) => {
      const delta = startY - e.touches[0].clientY;
      const newHeight = Math.min(Math.max(startHeight + delta, MIN_HEIGHT), MAX_HEIGHT);
      setHeight(newHeight);
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
  }, [height]);

  if (!isOpen) {
    // Show collapsed bar with port indicator
    return (
      <div className="border-t border-surface-600 bg-surface-800">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-700 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm">
            <Icons.externalLink />
            <span className="text-theme-secondary">App Preview</span>
            {hasPorts && (
              <span className="text-xs px-1.5 py-0.5 bg-frost-4/20 text-frost-3 rounded">
                {ports.length} port{ports.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <Icons.chevronUp />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col border-t border-surface-600 bg-surface-800"
      style={{ height }}
    >
      {/* Resize handle */}
      <div
        className="h-1 bg-surface-600 hover:bg-accent cursor-row-resize flex-shrink-0"
        onMouseDown={handleResizeStart}
        onTouchStart={handleTouchStart}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-600 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Icons.externalLink />
          <span className="text-sm font-medium text-theme-primary">App Preview</span>
          {hasPorts && (
            <span className="text-xs text-theme-muted">
              {ports.length} port{ports.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center">
          <IconButton onClick={onToggle} variant="compact" title="Collapse">
            <Icons.chevronDown />
          </IconButton>
        </div>
      </div>

      {/* Content */}
      <AppPreviewPanel
        instanceId={instanceId}
        className="flex-1 min-h-0"
        showHeader={true}
        onClose={onToggle}
      />
    </div>
  );
}

// Hook to manage drawer state with localStorage persistence
export function useAppPreviewDrawer(instanceId: string) {
  const [isOpen, setIsOpen] = useState(() => {
    const stored = localStorage.getItem(`app-preview-open-${instanceId}`);
    return stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem(`app-preview-open-${instanceId}`, String(isOpen));
  }, [instanceId, isOpen]);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, toggle, open, close };
}
