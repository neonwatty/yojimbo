import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('CONFIG', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses default values when env vars are not set', async () => {
    const { CONFIG } = await import('../config/index.js');

    expect(CONFIG.runtime.cwdPollIntervalMs).toBe(2000);
    expect(CONFIG.runtime.fileWatcherDebounceMs).toBe(100);
    expect(CONFIG.runtime.terminalMaxHistoryBytes).toBe(102400);
  });

  it('uses env var overrides when set', async () => {
    process.env.CWD_POLL_INTERVAL = '5000';
    process.env.FILE_WATCHER_DEBOUNCE = '200';
    process.env.TERMINAL_MAX_HISTORY = '204800';

    const { CONFIG } = await import('../config/index.js');

    expect(CONFIG.runtime.cwdPollIntervalMs).toBe(5000);
    expect(CONFIG.runtime.fileWatcherDebounceMs).toBe(200);
    expect(CONFIG.runtime.terminalMaxHistoryBytes).toBe(204800);
  });

  it('has correct default port', async () => {
    const { CONFIG } = await import('../config/index.js');
    expect(CONFIG.port).toBe(3456);
  });

  it('has correct default host', async () => {
    const { CONFIG } = await import('../config/index.js');
    // Host can be overridden by config.yaml, which defaults to 0.0.0.0 for network access
    expect(['127.0.0.1', '0.0.0.0']).toContain(CONFIG.host);
  });
});
