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

    -- indexes
    CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
    CREATE INDEX IF NOT EXISTS idx_instances_pinned ON instances(is_pinned);
    CREATE INDEX IF NOT EXISTS idx_sessions_instance ON sessions(instance_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON session_messages(session_id);
  `;

  db.exec(schema);
  console.log('✅ Database initialized');

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
