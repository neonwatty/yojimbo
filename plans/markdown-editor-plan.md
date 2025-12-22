# Markdown Editor Feature

## Overview

A built-in WYSIWYG markdown editor for creating and editing plans and documentation within the orchestrator. Uses MDX Editor for a Notion-like editing experience.

> **See it in action**: The editor panel is fully implemented in [`mockups/v2-with-editor.html`](../mockups/v2-with-editor.html). Toggle with the "Plans" button or ⌘E.

## Decision: MDX Editor

After evaluating Monaco Editor, CodeMirror 6, and MDX Editor:

| Editor | Verdict |
|--------|---------|
| Monaco | Overkill for markdown-only; better for code editing |
| CodeMirror 6 | Lightweight but requires significant setup |
| **MDX Editor** | WYSIWYG, plugin-based, ideal for plans/docs |

**Why MDX Editor:**
- WYSIWYG editing (no split preview needed)
- Notion/Google Docs-like experience
- Plugin architecture keeps bundle size manageable
- Built-in toolbar, tables, links, images
- React-native component
- MIT licensed

**Trade-off accepted:** Config file editing (YAML/JSON) deferred to future iteration. MDX Editor is markdown-focused.

---

## Feature Scope

### MVP Capabilities

1. **Create/Edit Plans**
   - New plan creation with templates
   - Edit existing plan files
   - Auto-save with dirty indicator

2. **File Browser Panel**
   - Browse `~/Library/Application Support/claude-orchestrator/plans/`
   - Tree view with folders
   - Create/rename/delete files
   - File type icons (`.md` files)

3. **Editor Features**
   - Headings (H1-H6)
   - Bold, italic, underline
   - Bullet and numbered lists
   - Blockquotes
   - Code blocks (display only, not editable as code)
   - Tables
   - Links
   - Undo/Redo

4. **Integration with Instances**
   - Associate a plan with an instance
   - Quick action: "Inject plan into instance" (pastes content)

### Deferred to Later

- YAML/JSON config editing (use Monaco later)
- Diff view for plan versions
- Git integration for plans
- Collaborative editing
- Image uploads (just link support for MVP)

---

## UI Design

### Layout Integration (Option B - Vertical Split)

The editor appears as a right-side panel, per-instance:

```
┌─────────────────────────────────────────────────────────────────────┐
│  CC Orchestrator                                    [History] [☼] [?]│
├─────────────────────────────────────────────────────────────────────┤
│  [← Back] ● Auth Refactor [Working]     ~/projects [Plans][Terminal]│
├───────────────────────────────────────┬─────────────────────────────┤
│                                       │  ┌─ Plans ──────────────┐  │
│  ┌─ Terminal ───────────────────────┐ │  │ auth-plan.md      ●  │  │
│  │ $ claude                         │ │  │ api-design.md        │  │
│  │ > Refactoring authentication...  │ │  │ ▶ templates/          │  │
│  │ > Reading src/middleware/auth.ts │ │  │ [+ New Plan]         │  │
│  │ > Analyzing token validation...  │ │  └──────────────────────┘  │
│  │                                  │ │  ┌─ auth-plan.md ───────┐  │
│  │                                  │ │  │ [B][I][U]|[H1][Inject]│  │
│  │                                  │ │  │ # Auth Refactor Plan │  │
│  │                                  │ │  │ This covers...       │  │
│  └──────────────────────────────────┘ │  └──────────────────────┘  │
└───────────────────────────────────────┴─────────────────────────────┘
```

> **Note**: Plans and Terminal buttons are now in the expanded instance header (not the main app header). The panel is only available when viewing an expanded instance.

### Key UX Decisions

1. **Per-instance plans**: Each terminal instance can have a linked plan
2. **Plans directory only**: Browser shows only the app's plans folder, not full filesystem
3. **Collapsible browser**: Plans list collapses to icon-only sidebar
4. **Plan linking**: Link/unlink plans to instances via toolbar button
5. **Inject action**: Button to paste plan content into the terminal

### Panel Behavior

- **Availability:** Only when viewing an expanded instance (not in card/list overview)
- **Toggle button:** Located in expanded instance header (not main app header)
- **Keyboard shortcut:** `Cmd+E` to toggle (only works in expanded view)
- **Panel position:** Right side (vertical split)
- **Horizontal resize:** Drag handle between terminal and right panel
- **Vertical resize:** Drag handle between plans browser and editor (within panel)
- **Plans browser:** Always visible when panel is open (not independently collapsible)

### Plan-Instance Association (Auto-Discovery)

Plans are **automatically discovered** based on the instance's working directory:

- When instance is in a directory with a `plans/` subdirectory, those plans are shown
- Multiple instances in the same working directory share the same plans
- Instances in directories without `plans/` show a prompt to create one
- No manual linking/unlinking - it's based on directory structure

```
~/projects/webapp/           ← instances here see plans from:
  └── plans/                 ← this directory
      ├── auth-plan.md
      ├── api-design.md
      └── templates/
          └── feature.md

~/projects/docs-site/        ← instances here have no plans
  └── (no plans/ directory)  ← shows "No plans directory" state
```

---

## Technical Architecture

### Frontend Components

```
src/components/
├── PlanEditor/
│   ├── PlanEditorPanel.tsx      # Container with file browser + editor
│   ├── FileBrowser.tsx          # Tree view of plan files
│   ├── MarkdownEditor.tsx       # MDX Editor wrapper
│   └── EditorToolbar.tsx        # Custom toolbar additions
```

### MDX Editor Configuration

```tsx
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  tablePlugin,
  codeBlockPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertTable,
  ListsToggle,
  UndoRedo,
} from '@mdxeditor/editor';

const plugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  tablePlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: 'text' }),
  markdownShortcutPlugin(),
  toolbarPlugin({
    toolbarContents: () => (
      <>
        <UndoRedo />
        <BoldItalicUnderlineToggles />
        <BlockTypeSelect />
        <ListsToggle />
        <CreateLink />
        <InsertTable />
      </>
    ),
  }),
];
```

### Backend (Node.js/Fastify)

```typescript
// packages/server/src/routes/plans.ts
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const plansRoutes: FastifyPluginAsync = async (fastify) => {
  // List plans for a working directory
  fastify.get('/api/plans', async (request, reply) => {
    const { workingDir } = request.query as { workingDir: string };
    const plansDir = path.join(workingDir, 'plans');

    try {
      const files = await listMarkdownFiles(plansDir);
      return { plans: files };
    } catch (error) {
      return { plans: [], error: 'Plans directory not found' };
    }
  });

  // Read a plan file
  fastify.get('/api/plans/:planId', async (request, reply) => {
    const { planId } = request.params as { planId: string };
    const { workingDir } = request.query as { workingDir: string };

    const planPath = path.join(workingDir, 'plans', planId);
    const content = await fs.readFile(planPath, 'utf-8');
    return { content };
  });

  // Write/update a plan file
  fastify.put('/api/plans/:planId', async (request, reply) => {
    const { planId } = request.params as { planId: string };
    const { workingDir, content } = request.body as { workingDir: string; content: string };

    const planPath = path.join(workingDir, 'plans', planId);
    await fs.writeFile(planPath, content, 'utf-8');
    return { success: true };
  });

  // Create a new plan
  fastify.post('/api/plans', async (request, reply) => {
    const { workingDir, name, template } = request.body as {
      workingDir: string;
      name: string;
      template?: string;
    };

    const plansDir = path.join(workingDir, 'plans');
    await fs.mkdir(plansDir, { recursive: true });

    const content = template || getDefaultTemplate(name);
    const planPath = path.join(plansDir, name);
    await fs.writeFile(planPath, content, 'utf-8');
    return { success: true, path: planPath };
  });

  // Delete a plan
  fastify.delete('/api/plans/:planId', async (request, reply) => {
    const { planId } = request.params as { planId: string };
    const { workingDir } = request.query as { workingDir: string };

    const planPath = path.join(workingDir, 'plans', planId);
    await fs.unlink(planPath);
    return { success: true };
  });
};
```

### File Watching

Use `chokidar` to detect external changes and broadcast via WebSocket:

```typescript
// packages/server/src/services/planWatcher.ts
import chokidar from 'chokidar';
import { WebSocketServer } from 'ws';

export class PlanWatcher {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();

  watchDirectory(workingDir: string, wss: WebSocketServer): void {
    const plansDir = path.join(workingDir, 'plans');

    if (this.watchers.has(plansDir)) return;

    const watcher = chokidar.watch(plansDir, {
      ignoreInitial: true,
      persistent: true,
    });

    watcher.on('all', (event, filePath) => {
      // Broadcast change to all connected clients
      wss.clients.forEach((client) => {
        client.send(JSON.stringify({
          type: 'plans-changed',
          event,
          path: filePath,
          workingDir,
        }));
      });
    });

    this.watchers.set(plansDir, watcher);
  }

  unwatchDirectory(workingDir: string): void {
    const plansDir = path.join(workingDir, 'plans');
    const watcher = this.watchers.get(plansDir);
    if (watcher) {
      watcher.close();
      this.watchers.delete(plansDir);
    }
  }
}
```

---

## Data Storage

### Plans Directory Structure

```
~/Library/Application Support/claude-orchestrator/
├── plans/
│   ├── templates/
│   │   ├── feature-implementation.md
│   │   ├── bug-fix.md
│   │   ├── code-review.md
│   │   └── research.md
│   └── user/
│       ├── project-a/
│       │   ├── auth-system.md
│       │   └── api-design.md
│       └── project-b/
│           └── notes.md
├── sessions/
└── config.json
```

### Plan-Instance Association

Stored in the session state:

```json
{
  "instances": [
    {
      "id": "abc123",
      "name": "Auth Feature",
      "plan_path": "user/project-a/auth-system.md"
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Basic Editor

1. Add MDX Editor dependency
2. Create `MarkdownEditor.tsx` component with basic plugins
3. Hardcode a test plan for development
4. Style to match orchestrator theme

### Phase 2: File Browser

1. Implement Tauri commands for file operations
2. Create `FileBrowser.tsx` with tree view
3. Wire up file selection to load into editor
4. Add create/delete file actions

### Phase 3: Save/Load Flow

1. Implement auto-save with debounce
2. Add dirty state indicator
3. Handle external file changes
4. Add Cmd+S manual save

### Phase 4: Integration

1. Add "Plans" button to expanded instance header (not main toolbar)
2. Pass panel state (`editorPanelOpen`, `onToggleEditorPanel`) to ExpandedInstanceView component
3. Implement Cmd+E toggle (restricted to expanded view only)
4. Add "Inject into instance" action

---

## Dependencies

```json
{
  "@mdxeditor/editor": "^3.x",
}
```

Peer dependencies (likely already present):
- React 18+
- React DOM

---

## Decisions

| Question | Decision |
|----------|----------|
| Frontmatter support | Deferred to post-MVP. MDX Editor can display YAML blocks as code. |
| Template variables | Deferred to post-MVP. Simple text plans for MVP. |
| Max file size | 1MB soft limit with warning. Plans are typically small. |
| Keyboard conflicts | Editor shortcuts only active when editor is focused. Terminal takes precedence otherwise. |
