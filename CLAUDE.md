# Yojimbo

A minimalist IDE for Claude Code power users — status-aware terminals, inline plan editing, and live mockup previews in a unified workspace.

## Architecture

TypeScript monorepo with 3 workspaces:

- **`client/`** — React 19, Vite 7, Tailwind CSS, Zustand, xterm.js, React Router 7
- **`server/`** — Express 5, node-pty, ssh2, better-sqlite3, WebSocket (ws)
- **`shared/`** — Shared TypeScript types (`shared/src/types/index.ts`) used by both client and server

All shared types are in `shared/src/types/index.ts` (822 lines). Import from `@cc-orchestrator/shared`. Build shared first when types change.

## Commands

```bash
# Development
make dev              # Start client + server concurrently
make dev-client       # Client only (Vite on :5173)
make dev-server       # Server only (Express on :3456)

# Build (must build shared → client → server in order)
npm run build         # Builds all workspaces in order

# Testing
make test-unit        # Vitest unit tests (server + client)
make test-e2e         # Playwright E2E tests (chromium + webkit)
npm run test:unit --workspace=server   # Server tests only
npm run test:unit --workspace=client   # Client tests only

# Code Quality
make lint             # ESLint across all workspaces
make lint-fix         # ESLint with auto-fix
make knip             # Unused code detection (knip)
make format           # Prettier formatting

# Database
make db-migrate       # Run SQLite migrations
make db-reset         # Reset database

# Hooks (Yojimbo's own Claude Code status hooks)
make hooks-install    # Install status tracking hooks
make hooks-check      # Verify hook installation
```

## Project Structure

```
client/src/
  components/         # React components (organized by feature)
  hooks/              # 18 custom React hooks
  pages/              # HomePage, InstancesPage, QueuePage, etc.
  store/              # 15 Zustand stores
  api/                # API client functions
  config/             # App configuration
  utils/              # Utility modules

server/src/
  routes/             # 21 Express route files
  services/           # 30 service modules (core logic)
  db/                 # SQLite connection & migrations
  websocket/          # WebSocket server for real-time events
  config/             # Server configuration

client/e2e/specs/     # 24 Playwright E2E test files
server/src/__tests__/ # 35 Vitest unit test files
```

## Key Patterns

- **State management**: Zustand stores in `client/src/store/`. Each feature has its own store.
- **API layer**: REST endpoints at `/api/*`, WebSocket for real-time events (terminal output, status changes, file changes)
- **Database**: SQLite with WAL mode, 11 tables, migration system in `server/src/db/connection.ts`
- **Terminal management**: node-pty spawns pseudo-terminals, xterm.js renders in browser, ws bridges them
- **Remote machines**: SSH connections via ssh2, port forwarding, keychain integration for credentials
- **Smart Tasks**: AI-powered todo parsing via Claude CLI with JSON schema output
- **PWA**: Progressive Web App with offline support via vite-plugin-pwa

## Conventions

- TypeScript strict mode across all workspaces
- ESLint: unused vars with `_` prefix allowed, `no-explicit-any` off, console allowed
- Shared types: always define in `shared/src/types/index.ts`, never duplicate across workspaces
- API responses: wrap in `ApiResponse<T>` type from shared
- WebSocket messages: typed via `WSServerMessage` / `WSClientMessage` from shared
- Tests: Vitest for unit tests, Playwright for E2E (sharded 3-way in CI: chromium + webkit)
- File naming: kebab-case for files (e.g., `session-watcher.service.ts`), PascalCase for React components

## CI Pipeline (GitHub Actions)

Runs on push to main and PRs:
1. **lint** — ESLint
2. **knip** — Unused code detection
3. **build** — Production build
4. **unit-tests** — Server + client Vitest
5. **e2e** — Playwright sharded 3 ways

## Deployment

- **Staging/Prod**: SSH via Tailscale VPN to Mac Mini servers, PM2 for process management
- **Docker**: Multi-stage Dockerfile available
- **Config**: `ecosystem.config.js` (PM2), `config.yaml` (runtime), `railway.toml` (Railway)
