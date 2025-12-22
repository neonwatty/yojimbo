# Claude Code Orchestrator

## Overview

A purpose-built desktop application for managing multiple parallel Claude Code instances with an intuitive UX, designed for developers who run many instances simultaneously and need better visibility and control.

> **Interactive Mockup**: See [`mockups/v2-with-editor.html`](../mockups/v2-with-editor.html) for the complete UI prototype demonstrating all MVP features, layouts, and interactions. Open in a browser to explore.

## Problem Statement

Running multiple Claude Code instances simultaneously is powerful but cumbersome with current tooling:

- Swiping between macOS desktops breaks flow state
- Tiling terminals creates information overload
- No native notification system for task completion
- Difficult to scale beyond 4-5 instances effectively
- No unified view of what each instance is doing
- Context loss and session management pain points

## Solution

A custom orchestrator app that provides:

- Unified management of many Claude Code instances in one window
- Visual status indicators for each instance (color-coded tabs, badges)
- Flexible layouts (tabs, cards, grid, list)
- Session persistence and restore on launch

-----

## MVP Scope

The MVP focuses on **human management of multiple Claude Code instances**—making it easy for a developer to create, monitor, switch between, and manage many parallel sessions without the cognitive overhead of current approaches.

**Platform:** macOS only for MVP

**Scale target:** Up to ~10 concurrent instances

### MVP Features

#### 1. Multi-Instance Terminal Management

- Each Claude Code instance runs in its own pseudo-terminal (pty), fully interactive
- Instance creation via a simple "+" button that opens a new terminal; user CDs into their desired directory and starts Claude Code
- Sessions can be restored on app launch (note: restores terminal state, not Claude conversation context)
- Instances can be named for easy identification (double-click or F2 to rename inline)
- All pty instances continue running when app is minimized

#### 2. Visual Status & Notifications

- Color-coded tabs or cards indicating instance state (working, idle, awaiting input, error)
- Status detection via Claude Code hooks reporting to the orchestrator's local API
- At-a-glance visibility into all instances without switching views

#### 3. Flexible Layout Options

- **Tab bar**: Traditional tabs with status colors/badges, overflow menu for excess tabs
- **Card/grid view**: Visual preview of each instance's recent output
- **List view**: Compact status badges with one-line summaries
- **Focus mode**: Expand one instance while others remain as thumbnails sidebar
- **Drag-and-drop reordering**: Reorder instances in all layouts via drag

#### 4. Instance Pinning

- Mark important instances to keep them visible/accessible regardless of activity
- Pinned instances appear prominently in all layout views (sorted to top)
- Click star icon to toggle pin state

#### 5. Instance Management

- **Renaming**: Double-click or F2 to rename inline, Enter to confirm, Esc to cancel
- **Closing**: Close button with confirmation dialog for active/pinned instances
- **Context menu**: Right-click for Rename, Duplicate, Pin/Unpin, Focus Mode, Close Others, Close to Right, Close
- **Confirmation dialogs**: Status-aware messages for working/awaiting/error instances

#### 6. Session Persistence

- Save current session state (open instances, names, working directories)
- Restore sessions on app launch
- Manual save/load of session configurations

#### 7. Session History View

- Browse past sessions grouped by date (Today, Yesterday, Older)
- Search sessions by name
- Expandable session cards showing messages and tool usage
- Token and message counts per session

#### 8. Plans/Markdown Editor Panel

- Right-side panel with plans browser and WYSIWYG editor
- Auto-discovery of plans from `{workingDir}/plans/` directory
- File tree navigation with folder support
- Toolbar: Bold, Italic, Underline, Headings, Lists
- Inject plan content into terminal
- Dirty state indicator for unsaved changes
- Toggle panel with ⌘E, full-screen with ⌘⇧E

#### 9. Theme & Accessibility

- Light/dark mode toggle (light mode default)
- Keyboard shortcuts modal (⌘?) showing all shortcuts
- Full keyboard navigation: ⌘1-9 (tabs), ⌘[/] (prev/next), F2 (rename), ⌘W (close)

#### 10. Home Dashboard

- Getting Started banner for new users
- Stat cards showing instance counts by status
- Pinned instances section
- Recent instances section
- Quick actions

-----

## Technical Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Orchestrator App                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   UI Layer  │  │  App State  │  │   Terminal Manager      │  │
│  │  (Webview)  │  │   (IPC)     │  │   (pty spawn)           │  │
│  │  + xterm.js │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Hook API Server                           │ │
│  │              (localhost HTTP endpoint)                       │ │
│  │                         │                                    │ │
│  │                         ▼                                    │ │
│  │                  ┌─────────────┐                             │ │
│  │                  │   SQLite    │                             │ │
│  │                  │  (state DB) │                             │ │
│  │                  └─────────────┘                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Claude Code Instances                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Instance 1│ │Instance 2│ │Instance 3│ │Instance N│            │
│  │  (pty)   │ │  (pty)   │ │  (pty)   │ │  (pty)   │            │
│  │          │ │          │ │          │ │          │            │
│  │  hooks ──┼─┼── POST ──┼─┼─► Hook API Server                  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

### Terminal Manager (Rust/Tauri backend)

- Spawns and manages multiple pty instances using `portable-pty`
- Tracks metadata for each instance (name, status, working directory, pinned state)
- Streams terminal output to frontend via Tauri IPC
- Receives input from frontend and writes to appropriate pty

### Hook API Server

- Local HTTP server (e.g., `localhost:PORT`) that Claude Code hooks call
- Receives status updates from hook scripts
- Writes state changes to SQLite database
- Emits Tauri events to notify frontend of state changes

### State Management & Search

- SQLite database stores instance states and event history
- Frontend subscribes to state changes via Tauri events
- Session configuration persisted to JSON file

### SQLite Schema & Full-Text Search

The SQLite database serves dual purposes: real-time state tracking and historical search. We use SQLite's FTS5 (Full-Text Search 5) extension for efficient searching.

#### Core Tables

```sql
-- Active instances (real-time state)
CREATE TABLE instances (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  working_dir TEXT NOT NULL,
  status TEXT CHECK(status IN ('working', 'awaiting', 'idle', 'error')),
  pinned BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME
);

-- Session history (searchable archive)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  instance_id TEXT,
  name TEXT NOT NULL,
  working_dir TEXT NOT NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  message_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  summary TEXT,
  FOREIGN KEY (instance_id) REFERENCES instances(id)
);

-- Session messages (for detailed search)
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tokens INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Status events (for state timeline)
CREATE TABLE status_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  instance_id TEXT NOT NULL,
  status TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (instance_id) REFERENCES instances(id)
);
```

#### Full-Text Search (FTS5)

```sql
-- FTS5 virtual table for searching session content
CREATE VIRTUAL TABLE sessions_fts USING fts5(
  name,
  summary,
  content='sessions',
  content_rowid='rowid'
);

-- FTS5 virtual table for searching messages
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  tool_name,
  content='messages',
  content_rowid='id'
);

-- Triggers to keep FTS tables in sync
CREATE TRIGGER sessions_ai AFTER INSERT ON sessions BEGIN
  INSERT INTO sessions_fts(rowid, name, summary)
  VALUES (new.rowid, new.name, new.summary);
END;

CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content, tool_name)
  VALUES (new.id, new.content, new.tool_name);
END;
```

#### Search Queries

```sql
-- Search sessions by name or summary
SELECT s.* FROM sessions s
JOIN sessions_fts ON sessions_fts.rowid = s.rowid
WHERE sessions_fts MATCH 'authentication refactor'
ORDER BY rank;

-- Search messages across all sessions
SELECT m.*, s.name as session_name FROM messages m
JOIN messages_fts ON messages_fts.rowid = m.id
JOIN sessions s ON m.session_id = s.id
WHERE messages_fts MATCH 'TypeError undefined'
ORDER BY m.created_at DESC;

-- Search with filters
SELECT s.* FROM sessions s
JOIN sessions_fts ON sessions_fts.rowid = s.rowid
WHERE sessions_fts MATCH 'bug fix'
  AND s.started_at > datetime('now', '-7 days')
ORDER BY s.started_at DESC;
```

#### Data Flow

```
Claude Code Instance
       │
       │ Hook callback (PreToolUse, Stop, etc.)
       ▼
┌──────────────────┐
│  Hook API Server │
│  (localhost:PORT)│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     ┌─────────────────┐
│     SQLite       │────►│   FTS5 Index    │
│  (state tables)  │     │ (search tables) │
└────────┬─────────┘     └─────────────────┘
         │
         │ Tauri event
         ▼
┌──────────────────┐
│   UI (Search)    │
│  - History view  │
│  - Global search │
└──────────────────┘
```

#### Search Features

| Feature | Implementation |
|---------|----------------|
| History search | Search sessions by name, summary, date range |
| Message search | Search across all message content |
| Tool search | Find sessions that used specific tools |
| Date filtering | Filter by relative or absolute date ranges |
| Status filtering | Filter by session end status (success, error) |
| Working dir filtering | Filter by project/directory |

### UI Layer

- Rendered in system webview (Tauri)
- xterm.js for terminal rendering
- Flexible layout components (tabs, cards, grid, list)

-----

## Status Detection via Hooks

Status detection uses Claude Code hooks to reliably track instance state. Each Claude Code instance is configured with hooks that report to the orchestrator's local API.

### Instance States

| State | Description | Visual Indicator |
|-------|-------------|------------------|
| **Working** | Claude is actively processing/executing tools | Animated/pulsing indicator |
| **Awaiting Input** | Claude finished, waiting for user response | Attention-grabbing color |
| **Idle** | Session open, no recent activity | Muted/neutral color |
| **Error** | Something went wrong | Red/error color |

### State Machine

```
                    ┌─────────────┐
      Instance      │             │
      Created  ───► │    IDLE     │ ◄─── No activity for N sec
                    │             │
                    └──────┬──────┘
                           │
                           │ PreToolUse
                           ▼
                    ┌─────────────┐
                    │             │
         ┌────────► │   WORKING   │ ◄──┐
         │          │             │    │
         │          └──────┬──────┘    │
         │                 │           │
         │ PreToolUse      │ Stop      │ PreToolUse
         │                 ▼           │
         │          ┌─────────────┐    │
         │          │  AWAITING   │ ───┘
         └───────── │    INPUT    │
                    └──────┬──────┘
                           │
                    Stop (error)
                           ▼
                    ┌─────────────┐
                    │    ERROR    │
                    └─────────────┘
```

### Claude Code Hooks Used

| Hook | Triggers State |
|------|----------------|
| `PreToolUse` | → Working |
| `Stop` (success) | → Awaiting Input |
| `Stop` (error) | → Error |
| Timeout after Stop | → Idle |

### Hook Configuration

Each Claude Code instance needs hooks configured to call the orchestrator API:

```bash
# Example hook script (PreToolUse)
#!/bin/bash
curl -X POST "http://localhost:$ORCHESTRATOR_PORT/api/status" \
  -H "Content-Type: application/json" \
  -d "{\"instance_id\": \"$INSTANCE_ID\", \"state\": \"working\"}"
```

The orchestrator provides a way to generate/install these hooks for each instance.

-----

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Desktop wrapper | Tauri | Lightweight, Rust backend, system webview |
| Terminal emulation | xterm.js | Mature, used by VS Code |
| Pty management | portable-pty (Rust) | Native pty bindings |
| State storage | SQLite | Instance states, event history |
| Hook API | Axum or built-in Tauri HTTP | Local HTTP server for hook callbacks |
| State/IPC | Tauri commands + events | Frontend ↔ backend communication |
| Session persistence | JSON file | Session configuration storage |
| Frontend | TBD | React, Svelte, or vanilla—to be determined during mockup phase |
| Markdown editor | MDX Editor | WYSIWYG plan editing (see `markdown-editor-plan.md`) |

-----

## Next Steps

1. **Mockup phase**: Create several UI/UX variations exploring:
   - Tab-based layouts with status indicators
   - Card/grid layouts with output previews
   - List views with compact status
   - Focus mode interactions
   - Instance pinning UX
2. **Evaluate mockups**: Test with actual workflows, determine optimal UX patterns
3. **Technical implementation**: Build the Tauri app incrementally:
   - Basic multi-terminal scaffold with xterm.js
   - Hook API server + SQLite integration
   - Tab/layout switching
   - Status indicator integration
   - Session persistence
   - Instance pinning

-----

## Future Improvements (Post-MVP)

> **Note**: Instance renaming, pinning, focus mode, close dialogs, session history, and plans editor have moved to MVP scope and are now implemented.

### Manager/Worker Coordination

A bidirectional communication pattern for orchestrating parallel work:

**Worker → Manager:**

- Worker completes a task
- Claude Code hook writes to SQLite queue
- App detects the event and injects a summary into the manager's terminal

**Manager → Worker:**

- Manager writes a dispatch instruction
- App detects the instruction and parses target worker
- App injects the instruction into the target worker's terminal

This would require:

- Extended SQLite coordination schema
- Claude Code hook configuration for each instance
- More complex state management

### Additional Future Features

Based on common Claude Code pain points:

- **Persistent context/memory**: Store and restore conversation context across sessions
- **Cost/usage dashboard**: Real-time token tracking per instance, aggregate views, burn rate predictions
- **Integrated diff viewer**: Show what each instance changed for easier code review
- **Git worktree integration**: Automatic worktree management for parallel sessions
- **Cross-instance search**: Search across all instance histories

-----

## Decisions Made

| Aspect | Decision |
|--------|----------|
| Instance creation | Plus button → blank terminal → user CDs manually |
| Authentication | Standard Claude Code flow (user handles in terminal) |
| Config sharing | Only root-level Claude Code settings shared |
| Max instances | ~10 (no terminal virtualization needed) |
| Platform | macOS only for MVP |
| Background behavior | All ptys continue running when minimized |
| File modification tracking | Not included in MVP |
| Status detection | Hook-based (not heuristic/regex) |
| Activity feed | Removed - redundant when all states visible in layouts |

-----

## Open Questions

- What's the right threshold for idle detection timeout?
- What port should the hook API server use? (fixed vs dynamic)

## Decisions Made (Updated)

| Question | Decision |
|----------|----------|
| Frontend framework | React (via CDN in mockup, Tauri webview in production) |
| Keyboard shortcuts | ⌘1-9 tabs, ⌘[/] prev/next, ⌘W close, ⌘E plans, ⌘? help, F2 rename, Enter/Esc focus |
| Default theme | Light mode (dark mode available via toggle) |
| Plan association | Auto-discovered from `{workingDir}/plans/` directory |
| Editor library | MDX Editor for WYSIWYG markdown |
