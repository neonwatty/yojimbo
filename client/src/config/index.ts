// Runtime configuration fetched from server
interface AppConfig {
  serverPort: number;
  platform: string; // 'darwin' for macOS, 'linux', 'win32', etc.
  label: string; // Optional label to distinguish installations (e.g., "DEV", "STABLE")
  tailscaleIp: string | null; // Tailscale IP for remote access
  lanIp: string | null; // LAN IP for local network access
}

// Default config (used before fetch completes or if fetch fails)
let config: AppConfig = {
  serverPort: 3456,
  platform: 'unknown',
  label: '',
  tailscaleIp: null,
  lanIp: null,
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

  // Update document title with environment label
  const displayLabel = getDisplayLabel();
  document.title = `[${displayLabel}] Yojimbo`;

  // Apply environment class for accent color theming
  const envMode = getEnvMode();
  document.documentElement.classList.add(`env-${envMode}`);

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
 * Get the API base URL for connecting to the server.
 * Uses window.location.hostname to work from any device on the network.
 */
export function getApiUrl(): string {
  const protocol = window.location.protocol;
  return `${protocol}//${window.location.hostname}:${config.serverPort}`;
}

/**
 * Get the full config object.
 */
export function getConfig(): AppConfig {
  return config;
}

/**
 * Check if the server is running on macOS.
 * Used to conditionally show macOS-specific features like Keychain unlock.
 */
export function isMacOS(): boolean {
  return config.platform === 'darwin';
}

/**
 * Get the installation label (e.g., "DEV", "STABLE").
 * Returns empty string if no label is configured.
 */
export function getLabel(): string {
  return config.label;
}

/**
 * Check if this is a dev installation.
 * Dev installations have labels like "DEV", "LOCAL", "DEVELOPMENT".
 */
export function isDevMode(): boolean {
  const label = config.label.toUpperCase();
  return label === 'DEV' || label === 'LOCAL' || label === 'DEVELOPMENT';
}

/**
 * Check if this is a staging installation.
 * Staging installations have labels like "STAGE", "STAGING".
 */
export function isStageMode(): boolean {
  const label = config.label.toUpperCase();
  return label === 'STAGE' || label === 'STAGING';
}

/**
 * Get the environment mode: 'dev', 'stage', or 'prod'.
 */
export function getEnvMode(): 'dev' | 'stage' | 'prod' {
  if (isDevMode()) return 'dev';
  if (isStageMode()) return 'stage';
  return 'prod';
}

/**
 * Get the display label for the environment.
 * Returns the configured label if set, or "PROD" for production.
 */
export function getDisplayLabel(): string {
  return config.label || 'PROD';
}

/**
 * Get the server's Tailscale IP address (if connected).
 */
export function getTailscaleIp(): string | null {
  return config.tailscaleIp;
}

/**
 * Get the server's LAN IP address.
 */
export function getLanIp(): string | null {
  return config.lanIp;
}

/**
 * Check if the current client is accessing from localhost.
 * Used to determine if we need to show remote access URLs.
 */
export function isLocalAccess(): boolean {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * Get the best URL base for accessing the server from mobile/remote devices.
 * Prefers Tailscale if available, falls back to LAN IP.
 * Returns null if no remote access is available.
 */
export function getRemoteAccessUrl(port: number): string | null {
  // If on mobile/tablet, prefer Tailscale for stability, then LAN
  if (config.tailscaleIp) {
    return `http://${config.tailscaleIp}:${port}`;
  }
  if (config.lanIp) {
    return `http://${config.lanIp}:${port}`;
  }
  return null;
}

/**
 * Get the localhost URL for a port.
 */
export function getLocalhostUrl(port: number): string {
  return `http://localhost:${port}`;
}
