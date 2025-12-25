// Runtime configuration fetched from server
interface AppConfig {
  host: string;
  serverPort: number;
  wsUrl: string;
}

// Default config (used before fetch completes or if fetch fails)
let config: AppConfig = {
  host: '127.0.0.1',
  serverPort: 3456,
  wsUrl: `ws://${window.location.hostname}:3456/ws`,
};

let initialized = false;

/**
 * Initialize config by fetching from server.
 * Should be called before React renders.
 */
export async function initConfig(): Promise<void> {
  if (initialized) return;

  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const serverConfig = await res.json();
      config = {
        ...config,
        ...serverConfig,
      };
    }
  } catch (err) {
    console.warn('Failed to fetch config from server, using defaults:', err);
  }

  initialized = true;
}

/**
 * Get the WebSocket URL for connecting to the server.
 */
export function getWsUrl(): string {
  return config.wsUrl;
}

/**
 * Get the full config object.
 */
export function getConfig(): AppConfig {
  return config;
}
