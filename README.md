# Claude Code Orchestrator

A purpose-built macOS desktop application for managing multiple parallel Claude Code instances with an intuitive UX.

## Quick Start

**View the interactive mockup**: Open [`mockups/v2-with-editor.html`](mockups/v2-with-editor.html) in a browser to explore the full UI prototype.

## Project Structure

```
cc-hard-core/
├── README.md                 # This file
├── mockups/
│   ├── v2-with-editor.html   # Current UI prototype (active)
│   └── variations/           # Design exploration (archived)
└── plans/
    ├── initial-plan.md       # Main project plan & MVP scope
    └── markdown-editor-plan.md  # Editor feature details
```

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

## Documentation

- [Main Plan](plans/initial-plan.md) - Full project scope, architecture, and decisions
- [Editor Plan](plans/markdown-editor-plan.md) - Markdown editor implementation details

## Status

**Phase**: Pre-implementation (mockup complete)

The interactive mockup demonstrates all MVP features. Next step is Tauri app scaffolding.
