# Desktop Workflows

Core user workflows for Yojimbo on desktop.

---

## Setup

### Prerequisites
- Node.js 18+
- Claude Code CLI installed (`claude` command available)
- Yojimbo running locally

### Start the App
```bash
make dev
```
Open `http://localhost:5175` in browser.

### Test Data
Most workflows can be tested with local instances. Create 2-3 test instances pointing to different directories to test switching, pinning, etc.

---

## 1. Getting Started

### First Launch
1. Open Yojimbo in browser (`http://localhost:5175`)
2. View the home dashboard with instance stats
3. Click "New Instance" or press `Cmd+N`

### Create Your First Instance
1. Press `Cmd+N` to open New Instance modal
2. Enter instance name
3. Pick working directory using the directory picker
4. Select Claude alias (e.g., `claude`, `claude --dangerously-skip-permissions`)
5. Click "Create" → Terminal spawns automatically

---

## 2. Managing Instances

### Create New Instance
1. `Cmd+N` → New Instance modal
2. Configure name, directory, alias
3. Create → Instance appears in sidebar

### Switch Between Instances
- `Cmd+1` through `Cmd+9` → Jump to instance by position
- `Cmd+[` / `Cmd+]` → Previous/Next instance
- Click instance in sidebar

### Pin Important Instances
- `Cmd+P` → Toggle pin on current instance
- Pinned instances appear at top of sidebar

### Rename Instance
- `F2` → Inline edit mode
- Type new name → Enter to save

### Close Instance
- `Cmd+W` → Close current instance
- Or click X on instance card

---

## 3. Working with Terminals

### Start Claude Code Session
1. Create or select instance
2. Terminal auto-focuses
3. Type `claude` (or your alias) → Press Enter
4. Claude Code starts in the terminal

### Monitor Claude Status
- **Green dot** = Idle (ready for input)
- **Orange dot** = Working (Claude processing)
- Status updates in real-time via hooks

### Use Split Panels
- `Cmd+E` → Toggle Plans panel (markdown editor)
- `Cmd+M` → Toggle Mockups panel (HTML preview)
- `Cmd+B` → Toggle sidebar
- Drag panel dividers to resize

---

## 4. Plans & Documentation

### Open Plans Panel
1. `Cmd+E` → Plans panel opens on right
2. Browse markdown files in working directory
3. Click file to open in editor

### Edit Plan Files
1. Select file from list
2. Edit markdown content
3. Changes auto-save

### Create New Plan
1. Click "+" in Plans panel
2. Enter filename
3. Start editing

---

## 5. Remote Machines

> **Note:** These workflows require real SSH access to a remote machine. Not testable locally without an actual remote server.

### Add Remote Machine
1. `Cmd+,` → Settings
2. Go to "Remote Machines" tab
3. Click "Add Machine"
4. Enter hostname, port, username, SSH key path
5. Click "Test Connection" to verify
6. Save

### Create Remote Instance
1. `Cmd+N` → New Instance
2. Toggle "Remote" mode
3. Select machine from dropdown
4. Configure directory and alias
5. Create → SSH connection established

### Manage SSH Keys
- Settings → Remote Machines
- Edit machine to change SSH key path
- Keychain integration for password-protected keys

---

## 6. Activity Tracking

### View Activity Feed
1. Click "Activity" in header
2. See real-time events (Started, Completed, Error)

### Filter Events
- Click filter dropdown
- Select: All, Started, Completed, Error
- Only matching events shown

### Manage Notifications
- Click event to mark as read
- "Mark All Read" button clears all
- Unread badge shows count

---

## 7. Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Command Palette | `Cmd+K` |
| New Instance | `Cmd+N` |
| Settings | `Cmd+,` |
| Shortcuts Help | `Cmd+/` |
| Close Instance | `Cmd+W` |
| Toggle Pin | `Cmd+P` |
| Rename | `F2` |
| Toggle Sidebar | `Cmd+B` |
| Toggle Plans | `Cmd+E` |
| Toggle Mockups | `Cmd+M` |
| Switch Instance | `Cmd+1-9` |
| Prev/Next Instance | `Cmd+[` / `Cmd+]` |
| Go Home | `G H` |
| Go Instances | `G I` |
| Go History | `G S` |

---

## Cleanup

### Close Test Instances
- `Cmd+W` to close each test instance
- Or use instance menu → Close

### Reset Database (Full Reset)
```bash
make db-reset
```
This clears all instances, remote machines, and activity history.

### Stop the App
```bash
make stop
```
