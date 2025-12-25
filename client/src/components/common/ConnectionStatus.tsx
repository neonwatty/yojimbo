import { useUIStore } from '../../store/uiStore';

export function ConnectionStatus() {
  const { isConnected, reconnectAttempts } = useUIStore();

  const config = isConnected
    ? { color: 'bg-emerald-500', textColor: 'text-emerald-400', label: 'Live', pulse: false }
    : reconnectAttempts > 0
    ? { color: 'bg-amber-500', textColor: 'text-amber-400', label: `Reconnecting (${reconnectAttempts}/5)`, pulse: true }
    : { color: 'bg-rose-500', textColor: 'text-rose-400', label: 'Offline', pulse: false };

  return (
    <div className="flex items-center gap-1.5 group relative">
      <div className={`w-2 h-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`} />
      <span className={`text-xs font-medium ${config.textColor}`}>{config.label}</span>

      {/* Tooltip with details */}
      <div className="absolute top-full left-0 mt-2 px-2 py-1 rounded bg-surface-700 text-xs
        opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {isConnected ? 'WebSocket connected' : reconnectAttempts > 0 ? 'Attempting reconnection...' : 'Connection lost'}
      </div>
    </div>
  );
}
