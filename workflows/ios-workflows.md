# iOS Workflows

> Mobile workflow documentation for Yojimbo
> Last updated: 2026-01-22
> App URL: http://localhost:5175 (or your machine's IP)

## Quick Reference

| Workflow | Purpose | Steps |
|----------|---------|-------|
| Getting Started | Access mobile UI and understand navigation | 4 |
| Managing Instances | View, create, switch between instances | 6 |
| Terminal Interaction | Full-screen terminal with touch input | 4 |
| Task Management | Create, complete, delete tasks with swipe | 5 |
| Task Dispatch | Send tasks to instances or clipboard | 4 |
| Clone & Create Instance | Clone repo and create instance from Smart Tasks | 6 |

---

## Setup

### Prerequisites
- Node.js 18+
- Yojimbo running locally (`make dev`)
- iOS Simulator (Xcode) or mobile device on same network
- iOS Simulator MCP server (for automated testing)

### Access on iOS Simulator
1. Open iOS Simulator (via Xcode or `open -a Simulator`)
2. Open Safari in simulator
3. Navigate to `http://localhost:5175`
4. App auto-detects mobile viewport and switches to mobile layout

### Access on Physical Device
1. Ensure device is on same network as dev machine
2. Find your machine's IP (shown in Vite output)
3. Open that URL in mobile Safari/Chrome

---

## 1. Getting Started

> Tests initial mobile UI access and navigation discovery.

1. Open Yojimbo URL on mobile device or iOS Simulator
   - Navigate to `http://localhost:5175` in Safari
   - Wait for page to load completely
   - Verify app automatically switches to mobile layout

2. Discover navigation gestures
   - Swipe down from top edge (within 60px) to open settings drawer
   - Verify drawer slides down with navigation options
   - Swipe up from bottom edge (within 60px) to open instances drawer
   - Verify drawer slides up with instance list

3. Navigate using settings drawer
   - Swipe down from top to open settings drawer
   - Tap "Home" to go to dashboard view
   - Tap "Tasks" to go to tasks view
   - Note: History and Activity tabs are temporarily disabled

4. Verify landscape orientation behavior
   - Rotate device to landscape
   - Verify sidebar appears on left side (200px width)
   - Verify instance list is always visible in sidebar
   - Rotate back to portrait
   - Verify sidebar hides and gestures are re-enabled

---

## 2. Managing Instances

> Tests viewing, creating, and switching between terminal instances.

1. View instance list
   - Swipe up from bottom edge to open instances drawer
   - Verify all instances are listed with status indicators
   - Verify pinned instances appear at top of list
   - Note status dots: green (idle), yellow (working)

2. Create new instance
   - Tap "+" button in instances drawer
   - Enter instance name in the name field
   - Tap directory picker to select working directory
   - Select Claude alias from dropdown
   - Tap "Create" button
   - Verify new instance appears in list

3. Open an instance
   - Swipe up from bottom to open instances drawer
   - Tap on an instance name
   - Verify terminal view opens full-screen
   - Verify instance header shows name and status

4. Switch between instances
   - With an instance open, swipe up from bottom
   - Tap a different instance in the drawer
   - Verify terminal switches to new instance
   - Verify previous terminal state is preserved

5. Long-press instance for actions
   - Swipe up to open instances drawer
   - Long-press (hold ~500ms) on an instance
   - Verify action sheet appears with options
   - Tap outside to dismiss action sheet

6. Verify instance status updates
   - Open an instance that's running Claude
   - Verify status indicator updates in real-time
   - Verify header shows current Claude status

---

## 3. Terminal Interaction

> Tests full-screen terminal with touch input and keyboard.

1. Open full-screen terminal
   - Tap an instance to open it
   - Verify terminal fills the screen
   - Verify instance header is visible at top

2. Focus terminal and type
   - Tap anywhere in terminal area
   - Verify on-screen keyboard appears
   - Type a test command (e.g., `ls`)
   - Press Enter/Return
   - Verify command executes and output displays

3. View Claude status in terminal
   - Observe status indicator in terminal header
   - Verify it updates as Claude works
   - Verify status changes: idle → working → idle

4. Dismiss keyboard and navigate away
   - Tap outside keyboard or swipe down to dismiss
   - Swipe up from bottom edge to open instances drawer
   - Verify can navigate to different instance

---

## 4. Task Management

> Tests creating, completing, and deleting tasks with swipe gestures.

1. Navigate to Tasks view
   - Swipe down from top edge to open settings drawer
   - Tap "Tasks" navigation button
   - Verify tasks list view appears
   - Note pending task count in header

2. Create a new task
   - Tap "Add a task..." input field at top
   - Type task description (e.g., "Fix the login bug")
   - Tap "Add" button
   - Verify task appears in list with empty checkbox

3. Mark task as done
   - Swipe left on a task (>80px) to reveal action buttons
   - Verify three buttons appear: Dispatch (blue), Done (green), Delete (red)
   - Tap the green checkmark button
   - Verify task shows strikethrough text and green checkbox

4. Delete a task
   - Swipe left on a task to reveal action buttons
   - Tap the red trash button
   - Verify task is removed from list

5. Toggle task status
   - Swipe left on a completed task
   - Tap green checkmark again
   - Verify task returns to pending state (no strikethrough)

---

## 5. Task Dispatch

> Tests sending tasks to running instances or clipboard.

1. Open dispatch options
   - Swipe left on a task to reveal action buttons
   - Tap the blue send/dispatch button
   - Verify bottom sheet modal slides up with dispatch options

2. Copy task to clipboard
   - In dispatch sheet, tap "Copy to Clipboard"
   - Verify "Copied to clipboard" toast notification appears
   - Verify sheet closes

3. Dispatch to running instance
   - Swipe left on task and tap dispatch button
   - In dispatch sheet, view list of running instances
   - Note status indicators next to each instance
   - Tap an instance name
   - Verify task is dispatched and sheet closes
   - Verify task shows linked instance indicator (yellow badge)

4. Create new instance with task
   - Swipe left on task and tap dispatch button
   - Tap "Create New Instance" option
   - Verify task text is copied to clipboard
   - Verify new instance modal opens
   - [MANUAL] Complete instance creation

---

## 6. Clone & Create Instance

> Tests cloning a repository and creating an instance via Smart Tasks (responsive modal).

**Note:** This workflow requires triggering the clone flow from Smart Tasks, which detects GitHub repository references.

1. Access Smart Tasks input
   - [MANUAL] On desktop, open the Tasks panel
   - Type a task mentioning a GitHub repo not yet registered
   - Example: "Review the neonwatty/bugdrop repository"
   - Tap Parse/Submit

2. Trigger clone modal
   - Verify Smart Tasks detects unknown project
   - Verify "Clone & Create Instance" button appears
   - Tap the Clone button
   - Verify Clone Setup modal opens

3. Review clone settings
   - Verify Repository URL is pre-populated
   - Verify Target Path shows default (e.g., ~/Desktop/bugdrop)
   - Verify Instance Name is auto-generated from repo name
   - Modify fields if needed

4. Validate clone path
   - Modify target path if desired
   - Wait for path validation (green checkmark = valid)
   - If path exists, see yellow warning
   - If parent doesn't exist, see red error

5. Execute clone
   - Tap "Clone & Create Instance" button
   - Verify progress indicator shows steps:
     1. Clone (cloning repository)
     2. Create Instance (creating terminal)
     3. Register (registering project)
   - Wait for "Setup Complete!" message

6. Open created instance
   - Tap "Open Instance" button
   - Verify terminal opens to cloned repository directory
   - Verify instance appears in instances list

---

## 7. Gesture Quick Reference

| Gesture | Location | Action |
|---------|----------|--------|
| Swipe down | Top edge (60px) | Open settings drawer |
| Swipe up | Bottom edge (60px) | Open instances drawer |
| Swipe left | Task item | Reveal action buttons |
| Tap | Instance in drawer | Open that instance |
| Long press | Instance in drawer | Show action menu |
| Tap | Terminal area | Focus and show keyboard |

### Navigation (Settings Drawer)

| Button | Status | Destination |
|--------|--------|-------------|
| Home | Active | Dashboard view |
| Tasks | Active | Tasks list view |
| History | Disabled | (Temporarily unavailable) |
| Activity | Disabled | (Temporarily unavailable) |
| Settings | Active | Settings modal |

---

## 8. Automation with iOS Simulator MCP

Use the iOS Simulator MCP server to automate mobile UI testing.

### Prerequisites
1. Xcode installed with iOS Simulator
2. `idb` (iOS Development Bridge) installed: `brew install idb-companion`

### Setup MCP Server
Add to your Claude Code MCP configuration:
```json
{
  "mcpServers": {
    "ios-simulator": {
      "command": "npx",
      "args": ["@anthropic/ios-simulator-mcp"]
    }
  }
}
```

### Simulator Management

| Tool | Purpose |
|------|---------|
| `list_simulators` | See all simulators with status |
| `boot_simulator` | Start specific simulator by UDID |
| `claim_simulator` | Reserve simulator for exclusive use |
| `open_simulator` | Open Simulator app window |

### UI Interaction

| Tool | Purpose |
|------|---------|
| `ui_view` | Get screenshot of current screen |
| `ui_describe_all` | Get accessibility tree of all elements |
| `ui_tap` | Tap at coordinates (x, y) |
| `ui_swipe` | Swipe gesture (start/end coordinates) |
| `ui_type` | Input text (ASCII only) |

### Recording

| Tool | Purpose |
|------|---------|
| `screenshot` | Save PNG screenshot |
| `record_video` | Start video recording |
| `stop_recording` | End and save video |

### Example: Test Task Swipe-to-Action
```
1. list_simulators → Find available iPhone simulator
2. boot_simulator → Start simulator
3. launch_app "com.apple.mobilesafari"
4. Navigate to localhost:5175
5. ui_tap on Tasks nav button
6. ui_swipe left on task item (x: 300→100, y: 200)
7. screenshot → Capture revealed action buttons
```

### Automation Limitations

| Limitation | Workaround |
|------------|------------|
| Non-ASCII text | Use ASCII only in `ui_type` |
| Permission dialogs | [MANUAL] Pre-configure in Settings |
| System alerts | [MANUAL] Dismiss manually |
| Keyboard shortcuts | Use `ui_tap` on buttons instead |

---

## Cleanup

### Close Test Instances
- Open instances drawer, long-press instance, select close

### Reset Database (Full Reset)
```bash
make db-reset
```

### Stop the App
```bash
make stop
```
