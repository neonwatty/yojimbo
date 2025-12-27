import { useUIStore } from '../../store/uiStore';

export function ConnectionStatus() {
  const { isConnected, reconnectAttempts } = useUIStore();

  const status = isConnected ? 'connected' : reconnectAttempts > 0 ? 'connecting' : 'disconnected';
  const label = isConnected ? 'Live' : reconnectAttempts > 0 ? `Retry ${reconnectAttempts}/5` : 'Offline';
  const tooltip = isConnected
    ? 'WebSocket connected'
    : reconnectAttempts > 0
    ? 'Attempting reconnection...'
    : 'Connection lost';

  return (
    <div className={`connection-status ${status} group relative`}>
      <span className="connection-status-dot" />
      <span className="text-theme-dim">{label}</span>

      {/* Tooltip with details */}
      <div className="absolute top-full left-0 mt-2 px-2 py-1 rounded bg-surface-700 border border-surface-600
        text-[10px] text-theme-secondary opacity-0 group-hover:opacity-100 transition-opacity
        pointer-events-none whitespace-nowrap z-50 shadow-lg">
        {tooltip}
      </div>
    </div>
  );
}
