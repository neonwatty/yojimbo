// Database schema definitions

export const SCHEMA = `
-- Active instances (real-time state)
CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  working_dir TEXT NOT NULL,
  status TEXT CHECK(status IN ('working', 'awaiting', 'idle', 'error')) DEFAULT 'idle',
  pinned INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  last_activity_at TEXT
);

-- Session history (searchable archive)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  instance_id TEXT,
  name TEXT NOT NULL,
  working_dir TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  message_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  summary TEXT,
  FOREIGN KEY (instance_id) REFERENCES instances(id)
);

-- Session messages (for detailed search)
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tokens INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Status events (for state timeline)
CREATE TABLE IF NOT EXISTS status_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (instance_id) REFERENCES instances(id)
);

-- User preferences (single row)
CREATE TABLE IF NOT EXISTS preferences (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme TEXT DEFAULT 'dark',
  terminal_font_size INTEGER DEFAULT 14,
  terminal_font_family TEXT DEFAULT 'JetBrains Mono',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Insert default preferences if not exists
INSERT OR IGNORE INTO preferences (id) VALUES (1);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_instances_status ON instances(status);
CREATE INDEX IF NOT EXISTS idx_sessions_instance ON sessions(instance_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_status_events_instance ON status_events(instance_id);
`;

// FTS5 tables for full-text search (post-MVP)
export const FTS_SCHEMA = `
-- FTS5 virtual table for searching session content
CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
  name,
  summary,
  content='sessions',
  content_rowid='rowid'
);

-- FTS5 virtual table for searching messages
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  tool_name,
  content='messages',
  content_rowid='id'
);

-- Triggers to keep FTS tables in sync
CREATE TRIGGER IF NOT EXISTS sessions_ai AFTER INSERT ON sessions BEGIN
  INSERT INTO sessions_fts(rowid, name, summary)
  VALUES (new.rowid, new.name, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content, tool_name)
  VALUES (new.id, new.content, new.tool_name);
END;
`;
