# Feature: Queue Mode

> A focused triage mode for cycling through idle Claude Code instances, reviewing their output, and dispatching new commands efficiently.

## Summary

Queue Mode provides a streamlined interface for managing multiple idle Claude Code instances. Instead of scanning through cards or lists to find instances needing attention, users enter a dedicated mode that presents one idle instance at a time with its recent output, quick action buttons, and a command input.

The queue is derived dynamically from instances with `status='idle'` (optionally including `error`). Users navigate via keyboard shortcuts (J/K, arrows) or swipe gestures on mobile. After dispatching a command, users can stay to watch progress or skip to the next idle instance. Settings and quick action favorites persist in SQLite.

This feature addresses the workflow pain point of managing many concurrent Claude instances—making it easy to "check in" on each one and keep them all productive.

## Requirements

### Must Have
- [ ] Dedicated route `/instances/queue` for queue mode
- [ ] Display one idle instance at a time with scrollable recent output
- [ ] Keyboard navigation: J/K or arrows for next/prev, S to skip (move to end)
- [ ] Queue position counter ("2 of 5 idle") with thumbnail previews
- [ ] Command input to dispatch work to current instance
- [ ] Quick action buttons (user-configurable favorites)
- [ ] "All caught up" state when queue is empty
- [ ] Settings: post-dispatch behavior (stay vs auto-advance)
- [ ] Settings: filter which statuses to include (idle, error)
- [ ] Persist settings and quick actions in SQLite per user
- [ ] Entry point: header button with idle count badge + Cmd+Q shortcut

### Should Have
- [ ] Mobile swipe gestures (framer-motion)
- [ ] Toast notification when instance closed externally
- [ ] Inline quick action editor (add/remove/reorder)
- [ ] Close instance action from queue view

### Out of Scope
- Per-instance command history for quick actions
- Context-inferred smart suggestions
- Full terminal access within queue mode (use "Open Full View" instead)

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
├─────────────────────────────────────────────────────────────┤
│  /instances/queue route                                      │
│       │                                                      │
│       ▼                                                      │
│  QueuePage.tsx                                               │
│       │                                                      │
│       ├──► useQueueMode() hook (queue logic)                │
│       │         │                                            │
│       │         ├──► instancesStore (idle instances)        │
│       │         ├──► queueStore (position, seen, settings)  │
│       │         └──► terminalBuffers (output extraction)    │
│       │                                                      │
│       ├──► QueueHeader (counter, thumbnails, nav)           │
│       ├──► QueueInstanceView (output, input, actions)       │
│       └──► QueueEmptyState ("all caught up")                │
│                                                              │
│  Mobile: QueueSwipeContainer (framer-motion)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Server                                │
├─────────────────────────────────────────────────────────────┤
│  Settings API (existing)                                     │
│       └──► queue_settings, quick_actions keys               │
│                                                              │
│  Instance API (existing)                                     │
│       └──► sendInput endpoint for command dispatch          │
│                                                              │
│  WebSocket (existing)                                        │
│       └──► status:changed events update queue               │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | File | Responsibility |
|-----------|------|----------------|
| `QueuePage` | `client/src/pages/QueuePage.tsx` | Route component, orchestrates queue mode |
| `QueueHeader` | `client/src/components/queue/QueueHeader.tsx` | Counter, thumbnails, navigation controls |
| `QueueInstanceView` | `client/src/components/queue/QueueInstanceView.tsx` | Current instance display with output and input |
| `QueueOutput` | `client/src/components/queue/QueueOutput.tsx` | Scrollable recent terminal output |
| `QuickActions` | `client/src/components/queue/QuickActions.tsx` | Quick action buttons + inline editor |
| `QueueEmptyState` | `client/src/components/queue/QueueEmptyState.tsx` | "All caught up" display |
| `QueueSwipeContainer` | `client/src/components/queue/QueueSwipeContainer.tsx` | Mobile swipe wrapper (framer-motion) |
| `QueueSettingsPanel` | `client/src/components/queue/QueueSettingsPanel.tsx` | Settings modal |
| `useQueueMode` | `client/src/hooks/useQueueMode.ts` | Core queue logic hook |
| `queueStore` | `client/src/store/queueStore.ts` | Zustand store for queue state |

### Data Model

**SQLite Settings (server)**

Uses existing `settings` table with new keys:

```typescript
// Key: 'queue_settings'
interface QueueSettings {
  postDispatchBehavior: 'stay' | 'auto-advance';
  includeStatuses: ('idle' | 'error')[];
}

// Key: 'quick_actions'
interface QuickAction {
  id: string;
  label: string;
  command: string;
  order: number;
}
type QuickActions = QuickAction[];
```

**Zustand Store (client)**

```typescript
// client/src/store/queueStore.ts
interface QueueState {
  // Ephemeral (session only)
  isActive: boolean;
  currentIndex: number;
  seenInstanceIds: Set<string>;

  // Synced from server
  settings: QueueSettings;
  quickActions: QuickAction[];

  // Actions
  setActive: (active: boolean) => void;
  next: () => void;
  prev: () => void;
  skip: () => void;  // moves current to end of seen
  markSeen: (instanceId: string) => void;
  updateSettings: (settings: Partial<QueueSettings>) => void;
  setQuickActions: (actions: QuickAction[]) => void;
}
```

**Derived Queue**

```typescript
// In useQueueMode hook
const idleInstances = instances.filter(i =>
  settings.includeStatuses.includes(i.status)
);

// Order: unseen first (by displayOrder), then seen (in order seen)
const queue = useMemo(() => {
  const unseen = idleInstances.filter(i => !seenInstanceIds.has(i.id));
  const seen = idleInstances.filter(i => seenInstanceIds.has(i.id));
  return [...unseen, ...seen];
}, [idleInstances, seenInstanceIds]);
```

### Terminal Output Extraction

To get recent output from xterm.js buffer:

```typescript
// client/src/hooks/useTerminalOutput.ts
export function useTerminalOutput(instanceId: string, lineCount = 50) {
  const terminalRef = useTerminalRef(instanceId);

  const getRecentOutput = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) return [];

    const buffer = terminal.buffer.active;
    const lines: string[] = [];
    const start = Math.max(0, buffer.length - lineCount);

    for (let i = start; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        lines.push(line.translateToString(true));
      }
    }

    return lines;
  }, [terminalRef, lineCount]);

  return { getRecentOutput };
}
```

### API Changes

No new endpoints required. Uses existing:

- `GET /api/settings` - fetch queue_settings and quick_actions
- `PATCH /api/settings` - update queue_settings and quick_actions
- `POST /api/instances/:id/input` - send command to instance (existing terminal input)

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Q` | Toggle queue mode (global) |
| `J` or `→` | Next instance |
| `K` or `←` | Previous instance |
| `S` | Skip (move to end of queue) |
| `Enter` | Focus command input |
| `Cmd/Ctrl+Enter` | Send command |
| `Escape` | Exit queue mode |
| `1-9` | Trigger quick action by position |

Register global shortcut in `App.tsx`, queue-specific shortcuts in `QueuePage.tsx`.

## Implementation Plan

### Phase 1: Foundation
1. Create `queueStore.ts` with state structure
2. Add queue settings keys to SQLite settings
3. Create `useQueueMode.ts` hook with queue derivation logic
4. Add `/instances/queue` route in `App.tsx`
5. Create basic `QueuePage.tsx` shell

### Phase 2: Core UI
1. Implement `QueueHeader.tsx` with counter and thumbnails
2. Implement `QueueInstanceView.tsx` layout
3. Create `useTerminalOutput.ts` hook for buffer extraction
4. Implement `QueueOutput.tsx` with scrollable output display
5. Add command input with send functionality
6. Wire up existing instance input API for dispatch

### Phase 3: Navigation & Actions
1. Implement keyboard navigation (J/K, arrows)
2. Add skip functionality (S key)
3. Implement `QuickActions.tsx` with button row
4. Add quick action inline editor
5. Create `QueueEmptyState.tsx` for "all caught up"

### Phase 4: Settings & Persistence
1. Create `QueueSettingsPanel.tsx` modal
2. Implement post-dispatch behavior toggle
3. Implement status filter toggles
4. Sync settings to/from server on load/save
5. Persist quick actions to server

### Phase 5: Entry Points & Polish
1. Add queue mode button to header with idle count badge
2. Register global Cmd+Q shortcut
3. Add toast for externally closed instances
4. Add "Open Full View" and "Close Instance" actions
5. Implement exit queue mode (Escape, button)

### Phase 6: Mobile & Gestures
1. Install framer-motion: `npm install framer-motion`
2. Create `QueueSwipeContainer.tsx` with drag gestures
3. Implement swipe left/right for navigation
4. Add swipe hints UI
5. Test and tune gesture thresholds

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Instance becomes idle while in queue | Silently add to end of unseen queue, update counter |
| Instance goes from idle to working | Remove from queue, if current then show toast + advance |
| Instance closed externally | Toast notification, auto-advance to next |
| All instances become non-idle | Show "all caught up" state |
| Command fails to send | Show error toast, keep on current instance |
| Settings fail to load | Use defaults (stay, idle-only) |
| No terminal buffer available | Show "Output not available" message |
| User navigates away mid-queue | Preserve position in session, reset on new session |

## Testing Strategy

**Unit Tests:**
- `queueStore` - state transitions, skip logic, seen tracking
- `useQueueMode` - queue derivation, filtering, ordering
- `useTerminalOutput` - buffer extraction edge cases

**Integration Tests:**
- Queue mode entry/exit flow
- Keyboard navigation sequence
- Command dispatch updates instance status
- Settings persistence round-trip

**E2E Tests:**
- Full queue triage flow: enter → review → dispatch → next → all caught up
- Mobile swipe navigation
- Quick action creation and usage

**Manual Testing:**
- Performance with 20+ idle instances
- Rapid navigation (hold J key)
- Swipe gesture feel on actual mobile device
- Keyboard shortcut conflicts

## Open Questions

- [ ] Should queue position persist if user navigates to full view and back?
- [ ] Maximum number of quick actions to display (before overflow)?
- [ ] Should thumbnails show instance names or just status dots?
- [ ] Animation duration for card transitions on mobile?

## Design Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Separate route vs toggle | URLs enable deep-linking, browser back works naturally | Toggle felt more "modal", harder to share state |
| Derive queue from instances | Queue is always fresh, no sync issues | Storing queue order adds complexity |
| framer-motion for swipes | Rich animations, spring physics, future gesture needs | react-swipeable lighter but less capable |
| Parse terminal buffer | Real output, no API changes needed | Server-side history would require new storage |
| Settings in SQLite | Persists across sessions, syncs with server | localStorage is client-only |
| Reuse input API | No new endpoints, consistent behavior | Queue-specific endpoint adds surface area |
