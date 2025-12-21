# Markdown Editor Feature

## Overview

A built-in WYSIWYG markdown editor for creating and editing plans and documentation within the orchestrator. Uses MDX Editor for a Notion-like editing experience.

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
│  CC Orchestrator                              [Plans]  [History] [☼]│
├─────────────────────────────────────────────────────────────────────┤
│  [Tab: auth-refactor ●📄] [Tab: api-tests] [Tab: docs 📄] [+]       │
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

### Key UX Decisions

1. **Per-instance plans**: Each terminal instance can have a linked plan
2. **Plans directory only**: Browser shows only the app's plans folder, not full filesystem
3. **Collapsible browser**: Plans list collapses to icon-only sidebar
4. **Full-screen editor**: Expand button opens editor in full-screen overlay
5. **Plan linking**: Link/unlink plans to instances via toolbar button
6. **Inject action**: Button to paste plan content into the terminal

### Panel Behavior

- **Keyboard shortcut:** `Cmd+E` to toggle entire right panel (Plans button in header)
- **Panel position:** Right side (vertical split)
- **Horizontal resize:** Drag handle between terminal and right panel
- **Vertical resize:** Drag handle between plans browser and editor (within panel)
- **Full-screen:** `Cmd+Shift+E` or expand button for editor only
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

### Backend (Tauri/Rust)

```rust
// File system commands for plan management

#[tauri::command]
async fn list_plans(app: tauri::AppHandle) -> Result<Vec<PlanFile>, String> {
    let plans_dir = app.path_resolver()
        .app_data_dir()
        .unwrap()
        .join("plans");
    // Recursively list .md files
}

#[tauri::command]
async fn read_plan(path: String) -> Result<String, String> {
    // Validate path is within plans directory
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_plan(path: String, content: String) -> Result<(), String> {
    // Validate path, write content
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_plan(name: String, template: Option<String>) -> Result<String, String> {
    // Create new plan file, optionally from template
}

#[tauri::command]
async fn delete_plan(path: String) -> Result<(), String> {
    // Validate and delete
}
```

### File Watching

Use Tauri's `notify` integration or the `tauri-plugin-fs-watch` to detect external changes:

```rust
// Watch plans directory for changes
// Emit event to frontend when files change
app.emit_all("plans-changed", payload)?;
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

1. Add "Plans" button to main toolbar
2. Implement panel toggle with Cmd+E
3. Add "Associate plan" action to instance context menu
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

## Open Questions

- [ ] Should plans support frontmatter (YAML header) for metadata?
- [ ] Template variable substitution (e.g., `{{PROJECT_NAME}}`)?
- [ ] Max file size limit for plans?
- [ ] Keyboard shortcut conflicts with terminal?
