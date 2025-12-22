# Claude Code Orchestrator

## Overview

A purpose-built application for managing multiple parallel Claude Code instances with an intuitive UX, designed for developers who run many instances simultaneously and need better visibility and control.

> **Interactive Mockup**: See [`mockups/v2-with-editor.html`](../mockups/v2-with-editor.html) for the complete UI prototype demonstrating all MVP features, layouts, and interactions. Open in a browser to explore.

-----

## Design Reference

> All visual specifications are derived from [`mockups/v2-with-editor.html`](../mockups/v2-with-editor.html). Open the mockup in a browser to see interactive examples.

### Design Tokens

Extract these from the mockup's CSS variables and Tailwind config:

```css
/* Light mode (default) */
:root {
  --surface-900: #f8fafc;  /* Page background */
  --surface-800: #f1f5f9;  /* Card backgrounds */
  --surface-700: #e2e8f0;  /* Elevated surfaces */
  --surface-600: #cbd5e1;  /* Borders, dividers */
  --surface-500: #94a3b8;  /* Disabled states */
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --border-color: #cbd5e1;
}

/* Dark mode */
.dark {
  --surface-900: #0a0a0b;
  --surface-800: #121214;
  --surface-700: #1a1a1e;
  --surface-600: #232328;
  --surface-500: #2d2d33;
  --text-primary: #ffffff;
  --text-secondary: #d1d5db;
  --text-muted: #6b7280;
  --border-color: #232328;
}

/* Status colors */
--state-working: #06b6d4;   /* Cyan - animated pulse */
--state-awaiting: #f59e0b;  /* Amber - attention */
--state-idle: #6b7280;      /* Gray - muted */
--state-error: #f43f5e;     /* Rose - error */

/* Accent */
--accent: #f59e0b;          /* Amber */
--accent-bright: #fbbf24;
--accent-dim: #d97706;
```

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Body | IBM Plex Sans | 400 | 15px |
| Headings | IBM Plex Sans | 600-700 | varies |
| Terminal | JetBrains Mono | 400 | 12px |
| Code | JetBrains Mono | 400 | 0.875em |
| Labels | IBM Plex Sans | 500 | 12px |

### Component Reference

| Component | Mockup Location | Key Styles |
|-----------|-----------------|------------|
| Tab bar | Header area | `bg-surface-700`, status dot left of name |
| Status dot | Tabs, cards, list rows | 12px circle, pulse animation for working |
| Status badge | Instance rows | Pill shape, icon + text, colored border |
| Instance card | Card layout view | `card-elevated` class, hover lift effect |
| Terminal | Main content area | Dark bg, `terminal-text` class, bottom glow |
| Plans panel | Right sidebar | Resizable, file tree + editor split |
| Confirmation dialog | Modal overlay | `card-elevated`, centered, shadow-2xl |
| Keyboard modal | Modal overlay | Grouped shortcuts, kbd styling |

### Layout Specifications

| Layout | Description | See in Mockup |
|--------|-------------|---------------|
| Tab bar | Horizontal tabs with overflow | Default view |
| Card grid | 2-3 column grid of instance cards | Click "Cards" in layout switcher |
| List view | Compact rows with status badges | Click "List" in layout switcher |
| Focus mode | Single instance expanded, others in sidebar | Double-click or Enter on instance |
| Plans panel | Right sidebar, vertical split | Click "Plans" button or ⌘E |

### Animations

| Animation | Duration | Easing | Usage |
|-----------|----------|--------|-------|
| `revealUp` | 0.5s | cubic-bezier(0.16, 1, 0.3, 1) | Page elements on load |
| `pulse-glow` | 2s | ease-in-out infinite | Working status indicator |
| `slideIn` | 0.3s | ease-out | Panel open |
| `expandIn` | 0.2s | ease-out | Focus mode |
| `hover-lift` | 0.2s | ease | Card hover (translateY -2px) |

-----

## Development Strategy

We're building this in two phases:

1. **Phase 1 (Current)**: Full-stack TypeScript application running locally in the browser
   - Faster iteration, no native compilation overhead
   - Full test coverage with Vitest + Playwright
   - CI/CD with GitHub Actions

2. **Phase 2 (Future)**: Wrap with Tauri for native desktop distribution
   - Frontend code ports directly to Tauri webview
   - Backend can run as sidecar or be ported to Rust

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

### System Overview

```
┌────────────────────────────────────────────────────────────────┐
│                    Browser (localhost:5173)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              React + Vite + Tailwind CSS                  │  │
│  │              + xterm.js terminal emulation                │  │
│  │              + Zustand state management                   │  │
│  └───────────────────────┬──────────────────────────────────┘  │
└──────────────────────────┼─────────────────────────────────────┘
                           │ WebSocket (terminals) + REST (API)
                           ▼
┌────────────────────────────────────────────────────────────────┐
│               Node.js Server (localhost:3001)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐       │
│  │  REST API   │  │  WebSocket  │  │   Hook API       │       │
│  │  (Fastify)  │  │  Server     │  │  (Claude status) │       │
│  └─────────────┘  └─────────────┘  └──────────────────┘       │
│         │                │                   │                  │
│         ▼                ▼                   ▼                  │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐       │
│  │   SQLite    │  │  node-pty   │  │   File Watcher   │       │
│  │ (sessions,  │  │ (terminal   │  │   (chokidar)     │       │
│  │  history)   │  │  processes) │  │   (plans dir)    │       │
│  └─────────────┘  └─────────────┘  └──────────────────┘       │
├────────────────────────────────────────────────────────────────┤
│                    Claude Code Instances                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │Instance 1│ │Instance 2│ │Instance 3│ │Instance N│          │
│  │  (pty)   │ │  (pty)   │ │  (pty)   │ │  (pty)   │          │
│  │          │ │          │ │          │ │          │          │
│  │  hooks ──┼─┼── POST ──┼─┼─► Hook API (port 3001)           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└────────────────────────────────────────────────────────────────┘
```

### Frontend (React + Vite)

- **Framework**: React 18 with TypeScript
- **Build**: Vite for fast HMR and optimized builds
- **Styling**: Tailwind CSS with custom design tokens
- **Terminal**: xterm.js with WebGL renderer for performance
- **State**: Zustand for global state, React Query for server state
- **Routing**: React Router for navigation (Home, Instances, History)

### Backend (Node.js + Fastify)

- **Framework**: Fastify for high-performance HTTP
- **Terminal Management**: node-pty for spawning/managing pty processes
- **WebSocket**: ws library for real-time terminal I/O
- **Database**: better-sqlite3 (synchronous, supports FTS5)
- **File Watching**: chokidar for plans directory monitoring
- **Validation**: Zod for request/response validation

### Communication Layer

| Channel | Purpose | Protocol |
|---------|---------|----------|
| REST API | CRUD operations, session management | HTTP |
| WebSocket | Terminal I/O, real-time status updates | WS |
| Hook API | Claude Code status callbacks | HTTP POST |

### Terminal Manager (Node.js)

- Spawns and manages multiple pty instances using `node-pty`
- Tracks metadata for each instance (name, status, working directory, pinned state)
- Streams terminal output to frontend via WebSocket
- Receives input from frontend and writes to appropriate pty
- Handles graceful shutdown and orphan cleanup

### Hook API Server

- Integrated into main Fastify server on same port
- Receives status updates from Claude Code hook scripts
- Writes state changes to SQLite database
- Broadcasts status changes to connected WebSocket clients

### State Management & Search

- SQLite database stores instance states and event history
- Frontend receives real-time updates via WebSocket
- Session configuration persisted to SQLite
- FTS5 for full-text search across session history

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

### Phase 1: TypeScript Full-Stack (Current)

| Layer | Technology | Notes |
|-------|------------|-------|
| **Frontend** | | |
| Framework | React 18 | Component library, hooks |
| Build tool | Vite | Fast HMR, optimized builds |
| Styling | Tailwind CSS | Utility-first, design tokens |
| State (client) | Zustand | Lightweight, TypeScript-first |
| State (server) | TanStack Query | Caching, background refetch |
| Terminal | xterm.js + xterm-addon-webgl | GPU-accelerated rendering |
| Markdown editor | MDX Editor | WYSIWYG (see `markdown-editor-plan.md`) |
| Routing | React Router v6 | Client-side navigation |
| **Backend** | | |
| Runtime | Node.js 20+ | LTS version |
| Framework | Fastify | High-performance HTTP |
| Terminal | node-pty | Native pty bindings |
| WebSocket | ws | Real-time communication |
| Database | better-sqlite3 | Sync API, FTS5 support |
| File watching | chokidar | Cross-platform file watcher |
| Validation | Zod | Runtime type validation |
| **Tooling** | | |
| Language | TypeScript 5.x | Strict mode enabled |
| Package manager | pnpm | Fast, disk-efficient |
| Linting | ESLint + Prettier | Consistent code style |
| Dead code | Knip | Unused files, deps, exports |
| Testing | Vitest + Playwright | Unit/integration + E2E |
| CI/CD | GitHub Actions | Automated testing & builds |

### Phase 2: Native Desktop (Future)

| Layer | Technology | Notes |
|-------|------------|-------|
| Desktop wrapper | Tauri v2 | Lightweight, Rust backend |
| Frontend | Same React app | Builds into Tauri webview |
| Backend | Node.js sidecar or Rust port | TBD based on performance needs |

-----

## Implementation Roadmap

> **Note**: This is the Phase 1 (TypeScript) roadmap. Tauri integration (Phase 2) begins only after all Phase 1 milestones are complete and stable.

### Milestone 1: Project Foundation

> **Design ref**: Extract Tailwind config from [mockup CSS variables](#design-tokens)

- [ ] Initialize monorepo with pnpm workspaces
- [ ] Set up `packages/client` with Vite + React + TypeScript
- [ ] Set up `packages/server` with Fastify + TypeScript
- [ ] Set up `packages/shared` for shared types/schemas
- [ ] Configure Tailwind CSS with design tokens from mockup (see [Design Tokens](#design-tokens))
- [ ] Set up ESLint + Prettier + Knip
- [ ] Create base tsconfig.json files
- [ ] Create Makefile with all commands
- [ ] Verify `make dev` starts both client and server

### Milestone 2: Backend Core

- [ ] Fastify server with CORS and health endpoint
- [ ] WebSocket server integration
- [ ] SQLite database setup with better-sqlite3
- [ ] Database migrations system
- [ ] Run initial migrations (instances, sessions, messages tables)
- [ ] node-pty terminal manager service
- [ ] Terminal spawn/kill/resize commands
- [ ] WebSocket terminal I/O streaming
- [ ] Integration tests for terminal manager

### Milestone 3: Frontend Core

> **Design ref**: See mockup for [layout shell](#layout-specifications), [typography](#typography), and [terminal styling](#component-reference)

- [ ] React Router setup (Home, Instances, History routes)
- [ ] Zustand store for app state
- [ ] TanStack Query setup for API calls
- [ ] WebSocket connection hook with reconnection
- [ ] xterm.js terminal component (see mockup `terminal-text` class)
- [ ] Terminal connects to backend via WebSocket
- [ ] Basic layout shell (header, sidebar, main area)
- [ ] Unit tests for stores and hooks

### Milestone 4: Multi-Instance Management

> **Design ref**: See mockup for [tab bar component](#component-reference), confirmation dialog, and context menu styling

- [ ] Create new instance (+ button)
- [ ] Tab bar with instance tabs (see mockup tab styling with status dots)
- [ ] Switch between instances
- [ ] Close instance with confirmation (see mockup `ConfirmDialog` component)
- [ ] Rename instance (inline editing - see mockup `EditableName` component)
- [ ] Pin/unpin instance (star icon in mockup)
- [ ] Drag-and-drop tab reordering
- [ ] Instance context menu (right-click)
- [ ] Keyboard shortcuts (⌘1-9, ⌘[, ⌘], ⌘W, F2) - see mockup `ShortcutsModal`
- [ ] E2E test: full instance lifecycle

### Milestone 5: Status Detection

> **Design ref**: See mockup for [status colors](#design-tokens), `StatusDot` component (with pulse animation), and `StatusBadge` component

- [ ] Hook API endpoint (`POST /api/hooks/status`)
- [ ] Claude Code hook script generator
- [ ] Status state machine (idle → working → awaiting → error)
- [ ] Status updates broadcast via WebSocket
- [ ] Visual status indicators (see mockup `StatusDot` with `pulse-working` animation)
- [ ] Status badges in all layouts (see mockup `StatusBadge` component)
- [ ] Idle timeout detection
- [ ] Integration tests for hook API

### Milestone 6: Layouts & Views

> **Design ref**: See mockup [layout specifications](#layout-specifications) and [animations](#animations). Toggle layouts in mockup to see each view.

- [ ] Tab bar layout (default) - see mockup default view
- [ ] Card/grid layout - see mockup `card-elevated` class, `hover-lift` animation
- [ ] List layout - see mockup `InstanceRow` component
- [ ] Focus mode (see mockup `FocusedTerminalView`, `ThumbnailInstance`, `expandIn` animation)
- [ ] Layout switcher in header
- [ ] Home dashboard with stats (see mockup `HomePage`, `StatCards` components)
- [ ] Pinned instances section (see mockup `PinnedInstances` component)
- [ ] Recent instances section (see mockup `RecentInstances` component)
- [ ] Light/dark theme toggle (see mockup CSS variables for both modes)
- [ ] Keyboard shortcuts modal (⌘?) - see mockup `ShortcutsModal` component

### Milestone 7: Session Persistence

- [ ] Save session state to SQLite
- [ ] Restore sessions on app start
- [ ] Auto-save on instance changes
- [ ] Manual session save/load
- [ ] Session metadata (name, created, message count)
- [ ] Graceful shutdown (save before exit)

### Milestone 8: Plans Editor

> **Design ref**: See mockup Plans panel (toggle with "Plans" button or ⌘E). Also see [`markdown-editor-plan.md`](./markdown-editor-plan.md) for detailed specs.

- [ ] Right-side panel toggle (⌘E) - see mockup `slideIn` animation
- [ ] Plans directory discovery (`{workingDir}/plans/`)
- [ ] File browser tree component (see mockup file tree with folder icons)
- [ ] MDX Editor integration (see mockup editor toolbar styling)
- [ ] Create new plan (+ New Plan button in mockup)
- [ ] Edit and save plan
- [ ] Delete plan with confirmation
- [ ] Dirty state indicator (● dot in mockup file list)
- [ ] Inject plan into terminal (Inject button in mockup toolbar)
- [ ] File watcher for external changes
- [ ] Full-screen editor mode (⌘⇧E)

### Milestone 9: Session History

> **Design ref**: See mockup History view (click "History" in header). Note session cards, date grouping, and search UI.

- [ ] Sessions list grouped by date (Today, Yesterday, Older - see mockup)
- [ ] Search sessions by name (see mockup search input styling)
- [ ] FTS5 full-text search across messages
- [ ] Expandable session cards (see mockup session card component)
- [ ] Message and token counts (displayed in session cards)
- [ ] Filter by working directory
- [ ] Filter by status

### Milestone 10: Testing & CI

- [ ] Unit test coverage ≥80%
- [ ] Integration tests for all API endpoints
- [ ] E2E tests for critical user journeys
- [ ] GitHub Actions CI workflow
- [ ] Codecov integration
- [ ] Branch protection rules
- [ ] All `make check` passes
- [ ] All `make ci` passes

### Milestone 11: Polish & Documentation

- [ ] Error boundaries in React
- [ ] Loading states for async operations
- [ ] Empty states (no instances, no plans, no history)
- [ ] Responsive layout adjustments
- [ ] README with setup instructions
- [ ] Contributing guide
- [ ] Architecture documentation

-----

### Phase 2: Tauri Integration (Future)

> **Prerequisites**: All Phase 1 milestones complete, tests passing, stable for 2+ weeks of use.

- [ ] Add Tauri to project
- [ ] Configure Tauri to load React app
- [ ] Decide: Node.js sidecar vs Rust port for backend
- [ ] Implement chosen backend approach
- [ ] macOS code signing
- [ ] macOS notarization
- [ ] Auto-update mechanism
- [ ] DMG installer
- [ ] Release workflow

-----

## Project Structure

```
cc-orchestrator/
├── packages/
│   ├── client/                 # React frontend
│   │   ├── src/
│   │   │   ├── components/     # React components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── pages/          # Route pages
│   │   │   ├── lib/            # Utilities
│   │   │   └── types/          # Frontend-specific types
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   ├── server/                 # Node.js backend
│   │   ├── src/
│   │   │   ├── routes/         # Fastify route handlers
│   │   │   ├── services/       # Business logic
│   │   │   ├── terminal/       # node-pty management
│   │   │   ├── database/       # SQLite + migrations
│   │   │   ├── websocket/      # WebSocket handlers
│   │   │   └── types/          # Backend-specific types
│   │   ├── migrations/         # SQL migration files
│   │   └── package.json
│   │
│   └── shared/                 # Shared code
│       ├── src/
│       │   ├── types/          # Shared TypeScript types
│       │   ├── schemas/        # Zod schemas
│       │   └── constants/      # Shared constants
│       └── package.json
│
├── tests/
│   ├── unit/                   # Vitest unit tests
│   ├── integration/            # API integration tests
│   └── e2e/                    # Playwright E2E tests
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # Main CI pipeline
│       └── release.yml         # Release workflow
│
├── Makefile                    # Development commands
├── pnpm-workspace.yaml
├── tsconfig.json               # Base TypeScript config
├── vitest.config.ts            # Vitest configuration
├── playwright.config.ts        # Playwright configuration
└── package.json                # Root package.json
```

-----

## Testing Strategy

### Test Pyramid

```
        ┌─────────────┐
        │    E2E      │  ~10 tests - Critical user journeys
        │ (Playwright)│
        ├─────────────┤
        │ Integration │  ~50 tests - API endpoints, WebSocket
        │  (Vitest)   │
        ├─────────────┤
        │    Unit     │  ~200 tests - Components, services, utils
        │  (Vitest)   │
        └─────────────┘
```

### Unit Tests (Vitest)

**Frontend:**
- React components with React Testing Library
- Custom hooks with renderHook
- Zustand stores
- Utility functions

**Backend:**
- Service layer functions
- Database operations (with in-memory SQLite)
- Terminal manager (mocked node-pty)
- Validation schemas

**Shared:**
- Zod schema validation
- Type guards
- Utility functions

### Integration Tests (Vitest)

- REST API endpoints (using Fastify's inject)
- WebSocket message handling
- Database migrations
- Hook API status updates
- File watcher events

### E2E Tests (Playwright)

| Test | Description |
|------|-------------|
| Create instance | New terminal, run command, verify output |
| Instance lifecycle | Create → rename → pin → close |
| Multi-instance | Switch between tabs, verify state |
| Plans editor | Create plan, edit, save, inject |
| Session history | Search, filter, expand sessions |
| Keyboard navigation | All shortcuts work correctly |

### Test Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['**/node_modules/**', '**/tests/**'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

-----

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm exec knip

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit
      - run: pnpm test:integration
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: |
            packages/client/dist
            packages/server/dist
```

### Branch Protection

- Require passing CI before merge
- Require code review approval
- No direct pushes to main

-----

## Error Handling & Resilience

### Error Categories

| Category | Examples | Handling |
|----------|----------|----------|
| **Terminal** | Pty spawn failure, process crash | Retry spawn, notify user, cleanup |
| **Network** | WebSocket disconnect, API timeout | Auto-reconnect with backoff |
| **Database** | SQLite lock, corruption | WAL mode, backup on startup |
| **File System** | Plans dir missing, permission denied | Create dir, graceful degradation |
| **Hook API** | Invalid payload, duplicate instance ID | Validate, log, reject gracefully |

### Terminal Crash Recovery

```typescript
// Pseudo-code for terminal resilience
class TerminalManager {
  private instances: Map<string, PtyInstance>;
  private healthCheckInterval: NodeJS.Timeout;

  async spawn(id: string, cwd: string): Promise<void> {
    try {
      const pty = await nodePty.spawn(shell, [], { cwd });
      this.instances.set(id, { pty, status: 'idle', cwd });
      this.attachHandlers(id, pty);
    } catch (error) {
      this.emit('spawn-error', { id, error });
      throw new TerminalSpawnError(id, error);
    }
  }

  private attachHandlers(id: string, pty: IPty): void {
    pty.onExit(({ exitCode }) => {
      const instance = this.instances.get(id);
      if (instance && !instance.intentionalClose) {
        this.emit('unexpected-exit', { id, exitCode });
        // Offer restart to user via WebSocket
      }
      this.cleanup(id);
    });
  }

  async gracefulShutdown(): Promise<void> {
    for (const [id, instance] of this.instances) {
      instance.intentionalClose = true;
      instance.pty.kill();
    }
    this.instances.clear();
  }
}
```

### WebSocket Reconnection

```typescript
// Client-side reconnection with exponential backoff
const useWebSocket = (url: string) => {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setStatus('connected');
      reconnectAttempts.current = 0;
    };

    ws.onclose = () => {
      setStatus('disconnected');
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
      reconnectAttempts.current++;
      setTimeout(connect, delay);
    };

    return ws;
  }, [url]);

  // ...
};
```

### Database Resilience

- **WAL mode**: Enables concurrent reads during writes
- **Startup backup**: Copy database file on app start
- **Migration rollback**: Each migration has up/down scripts
- **Graceful corruption handling**: Detect, backup corrupt file, recreate

### Process Cleanup on Exit

```typescript
// Ensure no orphan processes
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await terminalManager.gracefulShutdown();
  await database.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await terminalManager.gracefulShutdown();
  await database.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught exception:', error);
  await terminalManager.gracefulShutdown();
  process.exit(1);
});
```

-----

## Settings & Preferences

### User Preferences Schema

```typescript
interface UserPreferences {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  terminalFontSize: number;        // 10-24, default 13
  terminalFontFamily: string;      // default 'JetBrains Mono'
  terminalLineHeight: number;      // 1.0-2.0, default 1.5

  // Behavior
  idleTimeoutSeconds: number;      // 30-600, default 120
  confirmCloseWorking: boolean;    // default true
  confirmClosePinned: boolean;     // default true
  restoreSessionOnStart: boolean;  // default true

  // Keyboard
  shortcuts: Record<string, string>; // customizable shortcuts

  // Server
  hookApiPort: number;             // default 3001
  maxInstances: number;            // 1-20, default 10
}
```

### Settings Storage

- Stored in SQLite `preferences` table (single row)
- Loaded on app start, cached in memory
- Changes broadcast to all connected clients

### Settings UI (Future)

A dedicated settings modal with sections:
- Appearance
- Terminal
- Behavior
- Keyboard Shortcuts
- Advanced

For MVP: Use reasonable defaults, settings UI deferred.

-----

## Makefile

```makefile
# ============================================================================
# CC Orchestrator - Development Commands
# ============================================================================

.PHONY: help install dev build clean test lint format typecheck \
        test-unit test-integration test-e2e test-coverage \
        db-migrate db-reset docker-up docker-down

# Default target
help:
	@echo "CC Orchestrator - Available Commands"
	@echo "======================================"
	@echo ""
	@echo "Development:"
	@echo "  make install        Install all dependencies"
	@echo "  make dev            Start development servers (client + server)"
	@echo "  make dev-client     Start frontend dev server only"
	@echo "  make dev-server     Start backend dev server only"
	@echo "  make build          Build for production"
	@echo "  make clean          Remove build artifacts and node_modules"
	@echo ""
	@echo "Testing:"
	@echo "  make test           Run all tests"
	@echo "  make test-unit      Run unit tests"
	@echo "  make test-int       Run integration tests"
	@echo "  make test-e2e       Run E2E tests"
	@echo "  make test-watch     Run tests in watch mode"
	@echo "  make test-coverage  Run tests with coverage report"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint           Run ESLint"
	@echo "  make lint-fix       Run ESLint with auto-fix"
	@echo "  make format         Run Prettier"
	@echo "  make format-check   Check Prettier formatting"
	@echo "  make typecheck      Run TypeScript type checking"
	@echo "  make knip           Find unused code, deps, and exports"
	@echo "  make knip-fix       Auto-remove unused exports"
	@echo "  make check          Run all checks (lint + format + typecheck + knip)"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate     Run database migrations"
	@echo "  make db-reset       Reset database (WARNING: deletes data)"
	@echo "  make db-seed        Seed database with test data"
	@echo ""
	@echo "CI:"
	@echo "  make ci             Run full CI pipeline locally"

# ============================================================================
# Development
# ============================================================================

install:
	pnpm install

dev:
	pnpm dev

dev-client:
	pnpm --filter @cc-orchestrator/client dev

dev-server:
	pnpm --filter @cc-orchestrator/server dev

build:
	pnpm build

clean:
	rm -rf node_modules packages/*/node_modules
	rm -rf packages/*/dist
	rm -rf coverage playwright-report test-results
	rm -rf .turbo

# ============================================================================
# Testing
# ============================================================================

test: test-unit test-int

test-unit:
	pnpm test:unit

test-int:
	pnpm test:integration

test-e2e:
	pnpm exec playwright install --with-deps
	pnpm test:e2e

test-watch:
	pnpm test:unit -- --watch

test-coverage:
	pnpm test:unit -- --coverage
	@echo "Coverage report: coverage/index.html"

# ============================================================================
# Code Quality
# ============================================================================

lint:
	pnpm lint

lint-fix:
	pnpm lint --fix

format:
	pnpm exec prettier --write "packages/**/*.{ts,tsx,js,jsx,json,css,md}"

format-check:
	pnpm exec prettier --check "packages/**/*.{ts,tsx,js,jsx,json,css,md}"

typecheck:
	pnpm typecheck

knip:
	pnpm exec knip

knip-fix:
	pnpm exec knip --fix

check: lint format-check typecheck knip
	@echo "✓ All checks passed"

# ============================================================================
# Database
# ============================================================================

db-migrate:
	pnpm --filter @cc-orchestrator/server db:migrate

db-reset:
	@echo "WARNING: This will delete all data. Press Ctrl+C to cancel."
	@sleep 3
	rm -f packages/server/data/orchestrator.db
	pnpm --filter @cc-orchestrator/server db:migrate

db-seed:
	pnpm --filter @cc-orchestrator/server db:seed

# ============================================================================
# CI
# ============================================================================

ci: install check test test-e2e build
	@echo "✓ CI pipeline passed"
```

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

### Architecture & Stack

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Development approach | TypeScript full-stack first, Tauri later | Faster iteration, easier testing |
| Frontend framework | React 18 + Vite | Matches mockup, mature ecosystem |
| Backend framework | Fastify | High performance, TypeScript-first |
| Package manager | pnpm | Disk efficient, fast, workspace support |
| State management | Zustand (client) + TanStack Query (server) | Lightweight, TypeScript-friendly |
| Terminal library | node-pty + xterm.js | Industry standard, used by VS Code |
| Database | SQLite via better-sqlite3 | Sync API, FTS5 support, no server needed |

### Features & UX

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Instance creation | Plus button → blank terminal → user CDs manually | Simple, flexible |
| Authentication | Standard Claude Code flow (user handles in terminal) | No auth layer needed |
| Max instances | ~10 (soft limit, configurable) | Reasonable for most workflows |
| Platform | macOS only for MVP | Focus, simplify testing |
| Status detection | Hook-based (not heuristic/regex) | Reliable, official API |
| Plan association | Auto-discovered from `{workingDir}/plans/` | Convention over configuration |
| Editor library | MDX Editor | WYSIWYG, Notion-like experience |
| Default theme | Light mode (dark mode available) | Modern preference |
| Keyboard shortcuts | ⌘1-9 tabs, ⌘[/] prev/next, ⌘W close, ⌘E plans, ⌘? help | Standard conventions |

### Testing & CI

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Unit/integration tests | Vitest | Fast, ESM-native, good DX |
| E2E tests | Playwright | Cross-browser, reliable |
| CI platform | GitHub Actions | Free for open source, good ecosystem |
| Coverage threshold | 80% lines/statements | Balance between quality and velocity |

-----

## Open Questions

| Question | Status | Notes |
|----------|--------|-------|
| Idle detection timeout | **Decided: 120s** | Configurable in preferences |
| Hook API port | **Decided: 3001** | Same as main server, `/api/hooks/*` route |
| Tauri migration timing | Open | After core features stable + tested |
