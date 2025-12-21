# Claude Code Orchestrator

## Overview

A purpose-built desktop application for managing multiple parallel Claude Code instances with an intuitive UX, designed for developers who run many instances simultaneously and need better visibility and control.

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
- Instances can be named for easy identification
- All pty instances continue running when app is minimized

#### 2. Visual Status & Notifications

- Color-coded tabs or cards indicating instance state (working, idle, awaiting input, error)
- Status detection via Claude Code hooks reporting to the orchestrator's local API
- At-a-glance visibility into all instances without switching views

#### 3. Flexible Layout Options

- **Tab bar**: Traditional tabs with status colors/badges
- **Card/grid view**: Visual preview of each instance's recent output
- **List view**: Compact status badges with one-line summaries
- **Focus mode**: Expand one instance while others remain as thumbnails

#### 4. Instance Pinning

- Mark important instances to keep them visible/accessible regardless of activity
- Pinned instances appear prominently in all layout views

#### 5. Session Persistence

- Save current session state (open instances, names, working directories)
- Restore sessions on app launch
- Manual save/load of session configurations

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

### State Management

- SQLite database stores instance states and event history
- Frontend subscribes to state changes via Tauri events
- Session configuration persisted to JSON file

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

- What frontend framework for the UI? (React, Svelte, SolidJS, vanilla)
- Keyboard shortcut scheme for navigation?
- What's the right threshold for idle detection timeout?
- What port should the hook API server use? (fixed vs dynamic)
