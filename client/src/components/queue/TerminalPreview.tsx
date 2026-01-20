import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { getWsUrl } from '../../config';

interface TerminalPreviewProps {
  instanceId: string;
  maxLines?: number;
  onActivityChange?: (hasRecentActivity: boolean) => void;
}

// How many seconds of inactivity before we consider the terminal "idle"
const ACTIVITY_THRESHOLD_MS = 30000; // 30 seconds

// Strip ANSI escape codes for cleaner text display
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b[PX^_][^\x1b]*\x1b\\|\x1b\[\?[0-9;]*[a-zA-Z]/g, '');
}

// Parse terminal output into displayable lines
function parseTerminalOutput(data: string): string[] {
  const cleaned = stripAnsi(data);
  // Split by newlines and carriage returns
  const lines = cleaned.split(/\r?\n|\r/);
  // Filter out empty lines and trim
  return lines
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

export function TerminalPreview({
  instanceId,
  maxLines = 5,
  onActivityChange,
}: TerminalPreviewProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [lastActivityAt, setLastActivityAt] = useState<number | null>(null);
  const [hasRecentActivity, setHasRecentActivity] = useState(false);
  const isSubscribedRef = useRef(false);
  const activityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { send, subscribe, isConnected } = useWebSocket(getWsUrl());

  // Check activity status periodically
  useEffect(() => {
    const checkActivity = () => {
      if (lastActivityAt) {
        const isActive = Date.now() - lastActivityAt < ACTIVITY_THRESHOLD_MS;
        setHasRecentActivity(isActive);
        onActivityChange?.(isActive);
      }
    };

    // Check immediately
    checkActivity();

    // Then check every 5 seconds
    activityCheckIntervalRef.current = setInterval(checkActivity, 5000);

    return () => {
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
      }
    };
  }, [lastActivityAt, onActivityChange]);

  // Subscribe to terminal output
  useEffect(() => {
    if (!isConnected || isSubscribedRef.current) return;

    // Subscribe to this instance
    send('subscribe', { instanceId });
    isSubscribedRef.current = true;

    // Handle terminal output
    const unsubscribe = subscribe('terminal:output', (data: unknown) => {
      const { instanceId: msgInstanceId, data: output } = data as {
        instanceId: string;
        data: string;
      };

      if (msgInstanceId === instanceId && typeof output === 'string') {
        // Update last activity timestamp
        setLastActivityAt(Date.now());

        // Parse and add new lines
        const newLines = parseTerminalOutput(output);
        if (newLines.length > 0) {
          setLines(prev => {
            // Combine and keep only the last maxLines
            const combined = [...prev, ...newLines];
            return combined.slice(-maxLines);
          });
        }
      }
    });

    return () => {
      unsubscribe();
      send('unsubscribe', { instanceId });
      isSubscribedRef.current = false;
    };
  }, [isConnected, instanceId, send, subscribe, maxLines]);

  // Reset when instanceId changes
  useEffect(() => {
    setLines([]);
    setLastActivityAt(null);
    setHasRecentActivity(false);
    isSubscribedRef.current = false;
  }, [instanceId]);

  const isEmpty = lines.length === 0;

  return (
    <div className="bg-surface-900 rounded-lg p-3 min-h-[80px] relative overflow-hidden">
      {/* Activity indicator */}
      {hasRecentActivity && (
        <div className="absolute top-2 right-2">
          <span className="flex items-center gap-1.5 px-1.5 py-0.5 bg-state-working/20 text-state-working text-[9px] rounded">
            <span className="w-1.5 h-1.5 bg-state-working rounded-full animate-pulse" />
            Active
          </span>
        </div>
      )}

      {/* Terminal content */}
      <div className="font-mono text-xs leading-relaxed">
        {isEmpty ? (
          <div className="text-theme-dim opacity-50">
            No recent output...
          </div>
        ) : (
          <div className="space-y-0.5">
            {lines.map((line, index) => (
              <div
                key={`${index}-${line.slice(0, 20)}`}
                className="text-theme-secondary truncate"
                title={line}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
