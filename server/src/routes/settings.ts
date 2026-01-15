import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDatabase } from '../db/connection.js';
import { pruneActivityEvents } from '../services/feed.service.js';
import type { Settings, ApiResponse } from '@cc-orchestrator/shared';

const router = Router();

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  terminalFontSize: 14,
  terminalFontFamily: 'JetBrains Mono',
  showWelcomeBanner: true,
  // Client-side settings (stored in localStorage, not server DB)
  claudeCodeAliases: [],
  lastUsedDirectory: '~',
  lastInstanceMode: 'claude-code',
  // Activity Feed defaults
  showActivityInNav: true,
  feedEnabledEventTypes: ['completed'],
  feedRetentionDays: 7,
  feedMaxItems: 20,
};

function getSettingsFromDb(): Settings {
  const db = getDatabase();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];

  const settings: Settings = { ...DEFAULT_SETTINGS };

  for (const row of rows) {
    try {
      const value = JSON.parse(row.value);
      if (row.key === 'theme' && (value === 'light' || value === 'dark' || value === 'system')) {
        settings.theme = value;
      } else if (row.key === 'terminalFontSize' && typeof value === 'number') {
        settings.terminalFontSize = value;
      } else if (row.key === 'terminalFontFamily' && typeof value === 'string') {
        settings.terminalFontFamily = value;
      } else if (row.key === 'showWelcomeBanner' && typeof value === 'boolean') {
        settings.showWelcomeBanner = value;
      } else if (row.key === 'feedMaxItems' && typeof value === 'number') {
        settings.feedMaxItems = Math.max(20, Math.min(100, value));
      }
    } catch {
      // Ignore parse errors
    }
  }

  return settings;
}

// GET /api/settings - Get all settings
router.get('/', (_req: Request, res: Response) => {
  try {
    const settings = getSettingsFromDb();
    const response: ApiResponse<Settings> = { success: true, data: settings };
    res.json(response);
  } catch (error) {
    console.error('Failed to get settings:', error);
    const response: ApiResponse<Settings> = { success: false, error: 'Failed to get settings' };
    res.status(500).json(response);
  }
});

// PATCH /api/settings - Update settings
router.patch('/', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const updates = req.body as Partial<Settings>;

    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    const updateMany = db.transaction((entries: [string, unknown][]) => {
      for (const [key, value] of entries) {
        upsert.run(key, JSON.stringify(value));
      }
    });

    updateMany(Object.entries(updates));

    // If feedMaxItems was updated, immediately prune events to the new limit
    if (updates.feedMaxItems !== undefined) {
      const maxItems = Math.max(20, Math.min(100, updates.feedMaxItems));
      pruneActivityEvents(maxItems);
    }

    const settings = getSettingsFromDb();
    const response: ApiResponse<Settings> = { success: true, data: settings };
    res.json(response);
  } catch (error) {
    console.error('Failed to update settings:', error);
    const response: ApiResponse<Settings> = { success: false, error: 'Failed to update settings' };
    res.status(500).json(response);
  }
});

// POST /api/settings/reset-instance-status - Reset all instance statuses to idle
router.post('/reset-instance-status', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    // Reset all instance statuses to idle
    const result = db.prepare(`
      UPDATE instances
      SET status = 'idle', updated_at = datetime('now')
      WHERE closed_at IS NULL
    `).run();

    console.log(`🔄 Reset ${result.changes} instance(s) to idle status`);
    const response: ApiResponse<{ reset: boolean; count: number }> = {
      success: true,
      data: { reset: true, count: result.changes },
    };
    res.json(response);
  } catch (error) {
    console.error('Failed to reset instance status:', error);
    const response: ApiResponse<{ reset: boolean }> = {
      success: false,
      error: 'Failed to reset instance status',
    };
    res.status(500).json(response);
  }
});

// POST /api/settings/reset-database - Reset entire database
router.post('/reset-database', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();

    // Truncate all tables in a transaction
    db.transaction(() => {
      db.prepare('DELETE FROM session_messages').run();
      db.prepare('DELETE FROM sessions').run();
      db.prepare('DELETE FROM instances').run();
      db.prepare('DELETE FROM settings').run();

      // Re-insert default settings
      const upsert = db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
      `);
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        upsert.run(key, JSON.stringify(value));
      }
    })();

    console.log('🗑️ Database reset complete');
    const response: ApiResponse<{ reset: boolean }> = { success: true, data: { reset: true } };
    res.json(response);
  } catch (error) {
    console.error('Failed to reset database:', error);
    const response: ApiResponse<{ reset: boolean }> = { success: false, error: 'Failed to reset database' };
    res.status(500).json(response);
  }
});

// POST /api/settings/install-local-hooks - Install Claude Code hooks on local machine
router.post('/install-local-hooks', (req: Request, res: Response) => {
  try {
    const { serverUrl = 'http://localhost:3456' } = req.body as { serverUrl?: string };

    const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
    const CLAUDE_DIR = path.dirname(CLAUDE_SETTINGS_PATH);

    // Hooks configuration that uses CC_INSTANCE_ID environment variable
    // This env var is set by Yojimbo when spawning terminals
    const ORCHESTRATOR_HOOKS = {
      UserPromptSubmit: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: `curl -sX POST ${serverUrl}/api/hooks/status -H 'Content-Type: application/json' -d '{"event":"working","projectDir":"'"$CLAUDE_PROJECT_DIR"'","instanceId":"'"$CC_INSTANCE_ID"'"}' > /dev/null 2>&1 || true`,
              timeout: 5,
            },
          ],
        },
      ],
      PreToolUse: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: `curl -sX POST ${serverUrl}/api/hooks/status -H 'Content-Type: application/json' -d '{"event":"working","projectDir":"'"$CLAUDE_PROJECT_DIR"'","instanceId":"'"$CC_INSTANCE_ID"'"}' > /dev/null 2>&1 || true`,
              timeout: 5,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: `curl -sX POST ${serverUrl}/api/hooks/status -H 'Content-Type: application/json' -d '{"event":"working","projectDir":"'"$CLAUDE_PROJECT_DIR"'","instanceId":"'"$CC_INSTANCE_ID"'"}' > /dev/null 2>&1 || true`,
              timeout: 5,
            },
          ],
        },
      ],
      Notification: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: `curl -sX POST ${serverUrl}/api/hooks/notification -H 'Content-Type: application/json' -d '{"event":"awaiting","projectDir":"'"$CLAUDE_PROJECT_DIR"'","instanceId":"'"$CC_INSTANCE_ID"'"}' > /dev/null 2>&1 || true`,
              timeout: 5,
            },
          ],
        },
      ],
      Stop: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: `curl -sX POST ${serverUrl}/api/hooks/stop -H 'Content-Type: application/json' -d '{"event":"stopped","projectDir":"'"$CLAUDE_PROJECT_DIR"'","instanceId":"'"$CC_INSTANCE_ID"'"}' > /dev/null 2>&1 || true`,
              timeout: 5,
            },
          ],
        },
      ],
    };

    // Helper to check if a hook is an orchestrator hook
    const isOrchestratorHook = (hook: { hooks?: Array<{ command?: string }> }) => {
      return hook?.hooks?.some(h =>
        h.command?.includes('localhost:3456') ||
        h.command?.includes('/api/hooks/')
      );
    };

    // Load existing settings
    let settings: Record<string, unknown> = {};
    if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
      try {
        const content = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
        settings = JSON.parse(content);
      } catch {
        // If parse fails, start fresh
        settings = {};
      }
    }

    // Create .claude directory if it doesn't exist
    if (!fs.existsSync(CLAUDE_DIR)) {
      fs.mkdirSync(CLAUDE_DIR, { recursive: true });
    }

    // Backup existing settings
    if (fs.existsSync(CLAUDE_SETTINGS_PATH)) {
      const backupPath = `${CLAUDE_SETTINGS_PATH}.backup.${Date.now()}`;
      fs.copyFileSync(CLAUDE_SETTINGS_PATH, backupPath);
    }

    // Merge hooks
    const existingHooks = (settings.hooks || {}) as Record<string, unknown[]>;
    const mergedHooks: Record<string, unknown[]> = { ...existingHooks };

    for (const [eventType, hookConfigs] of Object.entries(ORCHESTRATOR_HOOKS)) {
      const existing = mergedHooks[eventType] || [];
      // Filter out any existing orchestrator hooks
      const filtered = existing.filter(config => !isOrchestratorHook(config as { hooks?: Array<{ command?: string }> }));
      // Add our new hooks
      mergedHooks[eventType] = [...filtered, ...hookConfigs];
    }

    settings.hooks = mergedHooks;

    // Save settings
    fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));

    console.log('🪝 Local Claude Code hooks installed successfully');
    const response: ApiResponse<{ installed: boolean; message: string }> = {
      success: true,
      data: {
        installed: true,
        message: 'Hooks installed successfully. They will activate for new Claude Code sessions in Yojimbo terminals.',
      },
    };
    res.json(response);
  } catch (error) {
    console.error('Failed to install local hooks:', error);
    const response: ApiResponse<{ installed: boolean }> = {
      success: false,
      error: `Failed to install hooks: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
    res.status(500).json(response);
  }
});

// GET /api/settings/check-local-hooks - Check if local hooks are installed
router.get('/check-local-hooks', (_req: Request, res: Response) => {
  try {
    const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

    if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) {
      const response: ApiResponse<{ installed: boolean; hookTypes: string[] }> = {
        success: true,
        data: { installed: false, hookTypes: [] },
      };
      return res.json(response);
    }

    const content = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
    const settings = JSON.parse(content);
    const hooks = settings.hooks || {};

    // Check which hook types have our orchestrator hooks
    const ourHookTypes = ['UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop', 'Notification'];
    const installedTypes: string[] = [];

    for (const hookType of ourHookTypes) {
      const hookList = hooks[hookType] || [];
      const hasOurs = hookList.some((h: { hooks?: Array<{ command?: string }> }) =>
        h?.hooks?.some((inner: { command?: string }) =>
          inner.command?.includes('/api/hooks/')
        )
      );
      if (hasOurs) {
        installedTypes.push(hookType);
      }
    }

    const response: ApiResponse<{ installed: boolean; hookTypes: string[] }> = {
      success: true,
      data: {
        installed: installedTypes.length === ourHookTypes.length,
        hookTypes: installedTypes,
      },
    };
    res.json(response);
  } catch (error) {
    console.error('Failed to check local hooks:', error);
    const response: ApiResponse<{ installed: boolean; hookTypes: string[] }> = {
      success: false,
      error: 'Failed to check hooks',
    };
    res.status(500).json(response);
  }
});

export default router;
