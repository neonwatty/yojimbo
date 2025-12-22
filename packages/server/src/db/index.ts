import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { SCHEMA } from './schema.js';

// Default database path
const DEFAULT_DB_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'cc-orchestrator'
);

let db: Database.Database | null = null;

export interface DbOptions {
  dbPath?: string;
  inMemory?: boolean;
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(options: DbOptions = {}): Database.Database {
  if (db) {
    return db;
  }

  let dbPath: string;

  if (options.inMemory) {
    dbPath = ':memory:';
  } else if (options.dbPath) {
    dbPath = options.dbPath;
  } else {
    // Ensure directory exists
    if (!fs.existsSync(DEFAULT_DB_DIR)) {
      fs.mkdirSync(DEFAULT_DB_DIR, { recursive: true });
    }
    dbPath = path.join(DEFAULT_DB_DIR, 'orchestrator.db');
  }

  db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run schema
  db.exec(SCHEMA);

  console.log(`Database initialized at: ${dbPath}`);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// For testing: reset database
export function resetDb(): void {
  if (db) {
    db.exec(`
      DELETE FROM status_events;
      DELETE FROM messages;
      DELETE FROM sessions;
      DELETE FROM instances;
      UPDATE preferences SET
        theme = 'dark',
        terminal_font_size = 14,
        terminal_font_family = 'JetBrains Mono',
        updated_at = datetime('now')
      WHERE id = 1;
    `);
  }
}
