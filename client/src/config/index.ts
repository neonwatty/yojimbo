// Runtime configuration fetched from server
interface AppConfig {
  serverPort: number;
}

// Default config (used before fetch completes or if fetch fails)
let config: AppConfig = {
  serverPort: 3456,
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
 * Uses window.location.hostname to work from any device on the network.
 */
export function getWsUrl(): string {
  // Use the same hostname the browser used to load the page
  // This ensures it works when accessed locally or from another device
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:${config.serverPort}/ws`;
}

/**
 * Get the full config object.
 */
export function getConfig(): AppConfig {
  return config;
}
