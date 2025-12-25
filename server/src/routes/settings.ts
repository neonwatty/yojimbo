import { Router, Request, Response } from 'express';
import { getDatabase } from '../db/connection.js';
import type { Settings, ApiResponse } from '@cc-orchestrator/shared';

const router = Router();

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  terminalFontSize: 14,
  terminalFontFamily: 'JetBrains Mono',
  showWelcomeBanner: true,
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

    const settings = getSettingsFromDb();
    const response: ApiResponse<Settings> = { success: true, data: settings };
    res.json(response);
  } catch (error) {
    console.error('Failed to update settings:', error);
    const response: ApiResponse<Settings> = { success: false, error: 'Failed to update settings' };
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

export default router;
