# Mobile Workflows

Core user workflows for Yojimbo on mobile devices (iOS Simulator / phone / tablet).

---

## Setup

### Prerequisites
- Node.js 18+
- Yojimbo running locally
- iOS Simulator (Xcode) or mobile device on same network

### Start the App
```bash
make dev
```

### Access on iOS Simulator
1. Open iOS Simulator (via Xcode or `open -a Simulator`)
2. Open Safari in simulator
3. Navigate to `http://localhost:5175`
4. App auto-detects mobile viewport and switches to mobile layout

### Access on Physical Device
1. Ensure device is on same network as dev machine
2. Find your machine's IP (shown in Vite output, e.g., `http://192.168.1.x:5175`)
3. Open that URL in mobile Safari/Chrome

### Test Data
Create 1-2 test instances from desktop first, then test viewing/managing them on mobile.

---

## 1. Getting Started

### Access Mobile UI
1. Open Yojimbo URL on mobile device or iOS Simulator
2. App automatically switches to mobile layout
3. Bottom tab bar appears for navigation

### Navigation Overview
- **Instances** tab → View and manage instances
- **History** tab → Browse past Claude sessions
- **Activity** tab → View real-time events
- **Tasks** tab → Task management

---

## 2. Managing Instances

### View Instance List
1. Tap "Instances" tab
2. See all instances with status indicators
3. Pinned instances appear at top

### Create New Instance
1. Tap "+" button in Instances view
2. Enter instance name
3. Pick working directory
4. Select Claude alias
5. Tap "Create"

### Switch Between Instances
- **Swipe left/right** → Navigate between instances
- **Tap instance** in list → Open that instance
- Gesture navigation for quick switching

### Instance Status
- Status dot shows Claude state (idle/working)
- Tap instance to view terminal

---

## 3. Terminal Interaction

### Full-Screen Terminal
1. Tap instance to open
2. Terminal fills screen
3. Swipe down to minimize

### Touch Input
- Tap terminal to focus
- On-screen keyboard appears
- Type commands as normal

### View Claude Status
- Status indicator in terminal header
- Updates in real-time as Claude works

---

## 4. Activity & History

### Check Activity Feed
1. Tap "Activity" tab
2. View events: Started, Completed, Error
3. Tap event to mark as read
4. Pull to refresh

### Browse Session History
1. Tap "History" tab
2. Scroll through past sessions
3. Tap session to expand
4. View conversation transcript

---

## 5. Quick Reference

### Gesture Controls
| Gesture | Action |
|---------|--------|
| Swipe left/right | Switch instances |
| Swipe down | Minimize terminal |
| Pull down | Refresh list |
| Tap | Select / Open |
| Long press | Context menu |

### Tab Bar Navigation
| Tab | Description |
|-----|-------------|
| Instances | Manage terminals |
| History | Past sessions |
| Activity | Event feed |
| Tasks | Task list |

---

## Cleanup

### Close Test Instances
- Swipe to instance → Use close option
- Or close from desktop UI

### Reset Database (Full Reset)
```bash
make db-reset
```

### Stop the App
```bash
make stop
```
