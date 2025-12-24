# Claude Code Orchestrator

A local web application for managing multiple Claude Code terminal instances with real-time status tracking, session history, and plans management.

## Features

- **Real Terminal Instances** - Full xterm.js terminals via node-pty with WebSocket I/O
- **Instance Management** - Card/list views with drag-drop reordering, pin favorites
- **Status Tracking** - Real-time Claude status via hooks (working, awaiting, idle)
- **Session History** - Automatically imports sessions from `~/.claude/projects/`
- **Plans Panel** - Browse and edit markdown files in `{workingDir}/plans/`
- **Keyboard Shortcuts** - Quick navigation, panel toggles, and vim-like sequences
- **Theme Support** - Dark and light themes

## Quick Start

```bash
# Install dependencies
npm install

# Start development servers
make dev

# Visit http://localhost:5173
```

## Installation

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Clone the repository
git clone https://github.com/neonwatty/cc-hard-core.git
cd cc-hard-core

# Install dependencies
npm install

# Initialize the database
make db-migrate

# Install Claude Code hooks (optional, enables status tracking)
make hooks-install
```

## Usage

### Development

```bash
make dev          # Start client + server in development mode
make dev-client   # Start only the client
make dev-server   # Start only the server
```

### Production

```bash
make build        # Build all packages
make start        # Start production server
make stop         # Stop running processes
```

### Database

```bash
make db-migrate   # Run migrations
make db-reset     # Reset database (delete and recreate)
make db-backup    # Backup database to backups/
```

### Claude Code Hooks

Hooks enable real-time status updates when Claude is working, waiting for input, or idle.

```bash
make hooks-install    # Install hooks to ~/.claude/settings.json
make hooks-uninstall  # Remove hooks
make hooks-check      # Verify hook installation
```

## Keyboard Shortcuts

### Quick Actions

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `Cmd+N` | Create new instance |
| `Cmd+/` | Show keyboard shortcuts |
| `Cmd+,` | Open settings |

### Navigation

| Shortcut | Action |
|----------|--------|
| `G H` | Go to Home |
| `G I` | Go to Instances |
| `G S` | Go to History |
| `Cmd+1-9` | Switch to instance by position |
| `Cmd+[` | Previous instance |
| `Cmd+]` | Next instance |
| `Escape` | Return to overview / Close modal |

### Instance Actions

| Shortcut | Action |
|----------|--------|
| `Cmd+W` | Close current instance |
| `Cmd+P` | Toggle pin |
| `F2` | Rename instance |

### Panels

| Shortcut | Action |
|----------|--------|
| `Cmd+B` | Toggle sessions sidebar |
| `Cmd+E` | Toggle plans panel |
| `Cmd+\`` | Toggle terminal panel |
| `Cmd+S` | Save current file (in editor panel) |

## Architecture

```
cc-hard-core/
├── client/          # React + Vite frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── store/   # Zustand state management
├── server/          # Express + node-pty backend
│   └── src/
│       ├── routes/
│       ├── services/
│       ├── websocket/
│       └── db/
└── shared/          # Shared TypeScript types
```

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite for bundling
- Tailwind CSS for styling
- xterm.js for terminal emulation
- Zustand for state management

**Backend:**
- Express.js
- node-pty for pseudo-terminals
- WebSocket for real-time communication
- better-sqlite3 for persistence
- chokidar for file watching

## API Endpoints

### Instances
- `GET /api/instances` - List all instances
- `POST /api/instances` - Create new instance
- `PATCH /api/instances/:id` - Update instance
- `DELETE /api/instances/:id` - Close instance
- `POST /api/instances/reorder` - Reorder instances

### Sessions
- `GET /api/sessions` - List sessions (paginated)
- `GET /api/sessions/search?q=` - Search sessions
- `GET /api/sessions/:id/messages` - Get session messages

### Plans
- `GET /api/plans?workingDir=` - List plans
- `GET /api/plans/:path` - Read plan file
- `PUT /api/plans/:path` - Update plan file
- `POST /api/plans` - Create plan file

### Settings
- `GET /api/settings` - Get settings
- `PATCH /api/settings` - Update settings

## WebSocket Events

The server communicates with clients via WebSocket at `ws://localhost:3456/ws`:

- `terminal:output` - PTY output data
- `terminal:input` - Send input to PTY
- `terminal:resize` - Resize terminal
- `instance:updated` - Instance state changed
- `status:changed` - Claude status changed

## Configuration

Environment variables (`.env`):

```bash
PORT=3456              # Server port
HOST=127.0.0.1         # Server host
NODE_ENV=development   # Environment
```

## Troubleshooting

### Terminal not connecting
- Ensure the server is running (`make dev-server`)
- Check WebSocket connection in browser dev tools

### Hooks not working
- Run `make hooks-check` to verify installation
- Ensure the orchestrator server is running when using Claude Code

### Session history empty
- Sessions are loaded from `~/.claude/projects/`
- The watcher runs on server startup

## License

MIT
