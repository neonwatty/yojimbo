# Yojimbo

Yojimbo is a minimalist IDE for Claude Code power users — status-aware terminals, inline plan editing, and live mockup previews in a unified workspace.

As usage scales, managing multiple terminals, tabs, tmux splits, markdown plans, and mockups becomes a serious productivity bottleneck. Yojimbo unblocks this by providing one place to:

- **Manage terminal instances** — with hooks into Claude Code so you always know which are churning, idle, or awaiting input
- **Remote SSH sessions** — connect to remote machines and track Claude status across your fleet
- **Activity feed** — real-time notifications when instances start, complete, or error
- **View markdown plans** — keep your roadmaps and specs visible alongside active work
- **Preview mockups** — render HTML files without leaving the environment
- **Mobile-optimized UI** — manage instances from your phone or tablet

## Getting Started

**Prerequisites:** Node.js 18+ and npm 9+

```bash
# Clone and install
git clone https://github.com/neonwatty/yojimbo.git
cd yojimbo
npm install

# Initialize the database
make db-migrate

# Install Claude Code hooks (this is what lights up the status indicators)
make hooks-install

# Start it up
make dev
```

Open http://localhost:5173 and you're in.

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
| `Cmd+M` | Toggle mockups panel |
| `Cmd+\`` | Toggle terminal panel |
| `Cmd+S` | Save current file (in editor panel) |

## Remote SSH Instances

Yojimbo can connect to remote machines via SSH, allowing you to manage Claude Code sessions running on other computers.

### Adding a Remote Machine

1. Navigate to **Settings** (`Cmd+,`)
2. Under **Remote Machines**, click **Add Machine**
3. Enter the machine details:
   - **Name**: A friendly name for the machine
   - **Hostname**: The SSH hostname or IP address
   - **Port**: SSH port (default: 22)
   - **Username**: Your SSH username
   - **SSH Key**: Select a key from `~/.ssh/` or use the default

### Creating Remote Instances

When creating a new instance, you can select a remote machine instead of "Local". The instance will open an SSH terminal to that machine and track Claude Code status remotely.

### Hooks on Remote Machines

For status tracking to work on remote instances, you need to configure hooks on the remote machine. Click **Hooks Config** on a remote instance to get the configuration JSON, then add it to `~/.claude/settings.json` on the remote machine.

### Status Reset

If an instance gets stuck showing "Working" status, you can manually reset it to "Idle" using the **Reset Status** button in the instance header.

## Activity Feed

The Activity Feed tracks events across all your instances:

- **Started** — When Claude begins working
- **Completed** — When Claude finishes a task
- **Error** — When something goes wrong

### Accessing the Activity Feed

- Click **Activity** in the header to view all events
- Unread events show a badge count
- Click an event to mark it as read
- Use **Mark all read** to clear all unread indicators

### Configuring Notifications

In Settings, under **Activity Feed**, you can:

- Toggle which event types to track (Completed, Error, Started)
- Set the retention period for old events
- Show/hide the Activity button in navigation

## Architecture

```
yojimbo/
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
- ssh2 for remote SSH connections
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

### Remote Machines
- `GET /api/machines` - List all remote machines
- `POST /api/machines` - Add a remote machine
- `PATCH /api/machines/:id` - Update machine settings
- `DELETE /api/machines/:id` - Remove a machine
- `POST /api/machines/:id/test` - Test SSH connection

### Activity Feed
- `GET /api/feed` - List activity events
- `GET /api/feed/stats` - Get unread count and totals
- `PATCH /api/feed/:id/read` - Mark event as read
- `POST /api/feed/mark-all-read` - Mark all events as read
- `DELETE /api/feed` - Clear all events

### Hooks
- `POST /api/hooks/status` - Status update from Claude Code hook
- `POST /api/hooks/notification` - Notification from Claude Code hook
- `POST /api/hooks/stop` - Stop event from Claude Code hook
- `GET /api/instances/:id/hooks-config` - Get hooks config for preview
- `POST /api/instances/:id/reset-status` - Manually reset instance status

## WebSocket Events

The server communicates with clients via WebSocket at `ws://localhost:3456/ws`:

- `terminal:output` - PTY output data
- `terminal:input` - Send input to PTY
- `terminal:resize` - Resize terminal
- `instance:updated` - Instance state changed
- `status:changed` - Claude status changed
- `feed:new` - New activity event created
- `feed:updated` - Activity event updated (e.g., marked as read)

## Configuration

Create a `config.yaml` file in the project root (see `config.example.yaml`):

```yaml
host: "127.0.0.1"      # Server bind address
serverPort: 3456       # API server port
clientPort: 5173       # Vite dev server port
```

Environment variables override the config file:

```bash
PORT=3456              # Overrides serverPort
HOST=127.0.0.1         # Overrides host
CLIENT_PORT=5173       # Overrides clientPort
NODE_ENV=development
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
