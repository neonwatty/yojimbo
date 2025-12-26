import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import CONFIG from '../config/index.js';

let db: Database.Database;

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): Database.Database {
  // Ensure data directory exists
  const dataDir = path.dirname(CONFIG.databasePath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create database connection
  db = new Database(CONFIG.databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema
  const schema = `
    -- instances table
    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      working_dir TEXT NOT NULL,
      last_cwd TEXT,
      status TEXT DEFAULT 'idle' CHECK(status IN ('working', 'awaiting', 'idle', 'error')),
      is_pinned INTEGER DEFAULT 0,
      display_order INTEGER,
      pid INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      closed_at TEXT
    );

    -- sessions table
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      instance_id TEXT,
      project_path TEXT NOT NULL,
      jsonl_path TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      message_count INTEGER DEFAULT 0,
      token_count INTEGER DEFAULT 0,
      summary TEXT,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE SET NULL
    );

    -- session_messages table
    CREATE TABLE IF NOT EXISTS session_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      message_type TEXT NOT NULL CHECK(message_type IN ('user', 'assistant', 'tool')),
      preview TEXT,
      token_count INTEGER,
      tool_name TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );

    -- settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- activity_feed table
    CREATE TABLE IF NOT EXISTS activity_feed (
      id TEXT PRIMARY KEY,
      instance_id TEXT,
      instance_name TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('completed', 'awaiting', 'error', 'started')),
      message TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      read_at TEXT
    );

    -- indexes
    CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
    CREATE INDEX IF NOT EXISTS idx_instances_pinned ON instances(is_pinned);
    CREATE INDEX IF NOT EXISTS idx_sessions_instance ON sessions(instance_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON session_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_feed_unread ON activity_feed(read_at) WHERE read_at IS NULL;
  `;

  db.exec(schema);

  // Run migrations for existing databases
  runMigrations();

  console.log('✅ Database initialized');

  return db;
}

function runMigrations(): void {
  // Check if last_cwd column exists, add if not
  const tableInfo = db.prepare("PRAGMA table_info(instances)").all() as { name: string }[];
  const hasLastCwd = tableInfo.some((col) => col.name === 'last_cwd');

  if (!hasLastCwd) {
    console.log('🔧 Running migration: adding last_cwd column to instances');
    db.exec('ALTER TABLE instances ADD COLUMN last_cwd TEXT');
  }
}

export function cleanupOldActivityEvents(retentionDays: number = 7): void {
  if (!db) return;

  const result = db.prepare(`
    DELETE FROM activity_feed
    WHERE created_at < datetime('now', '-' || ? || ' days')
  `).run(retentionDays);

  if (result.changes > 0) {
    console.log(`🧹 Cleaned up ${result.changes} old activity events (older than ${retentionDays} days)`);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
