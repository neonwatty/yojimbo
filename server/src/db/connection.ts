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

    -- remote_machines table
    CREATE TABLE IF NOT EXISTS remote_machines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      hostname TEXT NOT NULL,
      port INTEGER DEFAULT 22,
      username TEXT NOT NULL,
      ssh_key_path TEXT,
      status TEXT DEFAULT 'unknown' CHECK(status IN ('online', 'offline', 'unknown')),
      last_connected_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- port_forwards table
    CREATE TABLE IF NOT EXISTS port_forwards (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL,
      remote_port INTEGER NOT NULL,
      local_port INTEGER NOT NULL,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'closed', 'reconnecting', 'failed')),
      reconnect_attempts INTEGER DEFAULT 0,
      last_error TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );

    -- global_tasks table
    CREATE TABLE IF NOT EXISTS global_tasks (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      status TEXT DEFAULT 'captured' CHECK(status IN ('captured', 'in_progress', 'done', 'archived')),
      dispatched_instance_id TEXT,
      dispatched_at TEXT,
      completed_at TEXT,
      archived_at TEXT,
      display_order INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (dispatched_instance_id) REFERENCES instances(id) ON DELETE SET NULL
    );

    -- projects table (for Smart Tasks project registry)
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      git_remote TEXT,
      repo_name TEXT,
      last_activity_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- project_instances junction table (many-to-many)
    CREATE TABLE IF NOT EXISTS project_instances (
      project_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      PRIMARY KEY (project_id, instance_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );

    -- indexes
    CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
    CREATE INDEX IF NOT EXISTS idx_instances_pinned ON instances(is_pinned);
    CREATE INDEX IF NOT EXISTS idx_sessions_instance ON sessions(instance_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON session_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_activity_feed_created ON activity_feed(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_feed_unread ON activity_feed(read_at) WHERE read_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_remote_machines_status ON remote_machines(status);
    CREATE INDEX IF NOT EXISTS idx_port_forwards_instance ON port_forwards(instance_id);
    CREATE INDEX IF NOT EXISTS idx_port_forwards_status ON port_forwards(status);
    CREATE INDEX IF NOT EXISTS idx_global_tasks_status ON global_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_global_tasks_order ON global_tasks(display_order);
    CREATE INDEX IF NOT EXISTS idx_global_tasks_instance ON global_tasks(dispatched_instance_id);
    CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
    CREATE INDEX IF NOT EXISTS idx_projects_repo ON projects(repo_name);
    CREATE INDEX IF NOT EXISTS idx_projects_activity ON projects(last_activity_at DESC);
    CREATE INDEX IF NOT EXISTS idx_project_instances_project ON project_instances(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_instances_instance ON project_instances(instance_id);
  `;

  db.exec(schema);

  // Run migrations for existing databases
  runMigrations();

  console.log('✅ Database initialized');

  return db;
}

function runMigrations(): void {
  const tableInfo = db.prepare("PRAGMA table_info(instances)").all() as { name: string }[];
  const columnNames = new Set(tableInfo.map((col) => col.name));

  // Migration: add last_cwd column
  if (!columnNames.has('last_cwd')) {
    console.log('🔧 Running migration: adding last_cwd column to instances');
    db.exec('ALTER TABLE instances ADD COLUMN last_cwd TEXT');
  }

  // Migration: add machine_type column for remote instance support
  if (!columnNames.has('machine_type')) {
    console.log('🔧 Running migration: adding machine_type column to instances');
    db.exec("ALTER TABLE instances ADD COLUMN machine_type TEXT DEFAULT 'local'");
  }

  // Migration: add machine_id column for remote instance support
  if (!columnNames.has('machine_id')) {
    console.log('🔧 Running migration: adding machine_id column to instances');
    db.exec('ALTER TABLE instances ADD COLUMN machine_id TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_instances_machine ON instances(machine_id)');
  }

  // Ensure machine_id index exists (for fresh databases or if migration already ran)
  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_instances_machine ON instances(machine_id)');
  } catch {
    // Index might already exist, ignore
  }

  // Migration: add forward_credentials column to remote_machines
  const machinesTableInfo = db.prepare("PRAGMA table_info(remote_machines)").all() as { name: string }[];
  const machineColumns = new Set(machinesTableInfo.map((col) => col.name));
  if (!machineColumns.has('forward_credentials')) {
    console.log('🔧 Running migration: adding forward_credentials column to remote_machines');
    db.exec('ALTER TABLE remote_machines ADD COLUMN forward_credentials INTEGER DEFAULT 0');
  }

  // Migration: add reconnect_attempts and last_error columns to port_forwards
  const portForwardsTableInfo = db.prepare("PRAGMA table_info(port_forwards)").all() as { name: string }[];
  const portForwardsColumns = new Set(portForwardsTableInfo.map((col) => col.name));
  if (!portForwardsColumns.has('reconnect_attempts')) {
    console.log('🔧 Running migration: adding reconnect_attempts column to port_forwards');
    db.exec('ALTER TABLE port_forwards ADD COLUMN reconnect_attempts INTEGER DEFAULT 0');
  }
  if (!portForwardsColumns.has('last_error')) {
    console.log('🔧 Running migration: adding last_error column to port_forwards');
    db.exec('ALTER TABLE port_forwards ADD COLUMN last_error TEXT');
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

export function cleanupStalePortForwards(): void {
  if (!db) return;

  // On server restart, all active/reconnecting/failed port forwards are stale since the SSH tunnels don't survive
  const result = db.prepare(`
    UPDATE port_forwards SET status = 'closed', reconnect_attempts = 0, last_error = NULL
    WHERE status IN ('active', 'reconnecting', 'failed')
  `).run();

  if (result.changes > 0) {
    console.log(`🔌 Closed ${result.changes} stale port forward(s) from previous session`);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
