// Runtime configuration fetched from server
interface AppConfig {
  serverPort: number;
  platform: string; // 'darwin' for macOS, 'linux', 'win32', etc.
  label: string; // Optional label to distinguish installations (e.g., "DEV", "STABLE")
}

// Default config (used before fetch completes or if fetch fails)
let config: AppConfig = {
  serverPort: 3456,
  platform: 'unknown',
  label: '',
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
