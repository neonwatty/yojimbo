import { useUIStore } from '../../store/uiStore';

export function ConnectionStatus() {
  const { isConnected, reconnectAttempts } = useUIStore();

  const getStatusConfig = () => {
    if (isConnected) {
      return {
        color: 'bg-emerald-500',
        pulse: false,
        label: 'Connected',
        description: 'WebSocket connection active',
      };
    }

    if (reconnectAttempts > 0) {
      return {
        color: 'bg-amber-500',
        pulse: true,
        label: 'Reconnecting',
        description: `Attempting to reconnect... (${reconnectAttempts}/5)`,
      };
    }

    return {
      color: 'bg-rose-500',
      pulse: false,
      label: 'Disconnected',
      description: 'WebSocket connection lost',
    };
  };

  const config = getStatusConfig();

  return (
    <div className="relative group flex items-center">
      <div
        className={`
          w-2 h-2 rounded-full ${config.color}
          ${config.pulse ? 'animate-pulse' : ''}
        `}
        aria-label={config.label}
      />

      {/* Tooltip */}
      <div className="
        absolute top-full left-1/2 -translate-x-1/2 mt-2
        px-2 py-1 rounded text-xs whitespace-nowrap
        bg-surface-700 text-text-primary border border-surface-600
        opacity-0 group-hover:opacity-100 pointer-events-none
        transition-opacity duration-150
        shadow-lg z-50
      ">
        <div className="font-medium">{config.label}</div>
        <div className="text-text-secondary text-[10px]">{config.description}</div>
        {/* Arrow */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-surface-700 border-l border-t border-surface-600" />
      </div>
    </div>
  );
}
