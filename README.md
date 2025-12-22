# Claude Code Orchestrator

A purpose-built macOS desktop application for managing multiple parallel Claude Code instances with an intuitive UX.

## Quick Start

**View the interactive mockup**: Open [`mockup.html`](mockup.html) in a browser to explore the UI prototype.

## MVP Features

- **Multi-instance terminal management** with pty support
- **Flexible layouts**: Tabs, cards, list, focus mode
- **Visual status indicators**: Working, awaiting, idle, error
- **Instance management**: Rename, pin, close, duplicate, drag-to-reorder
- **Plans editor panel**: WYSIWYG markdown with auto-discovery
- **Session history**: Browse and search past sessions
- **Keyboard shortcuts**: Full navigation support (⌘?)
- **Light/dark theme**

## Tech Stack

| Component | Technology |
|-----------|------------|
| Desktop wrapper | Tauri |
| Terminal emulation | xterm.js |
| Pty management | portable-pty (Rust) |
| State storage | SQLite with FTS5 |
| Frontend | React |
| Markdown editor | MDX Editor |
