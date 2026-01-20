# Feature: Queue Mode - Idle Instance Review

> A triage-focused view for cycling through idle Claude Code instances, reviewing their status, and quickly dispatching new commands.

## Summary

Queue Mode is a dedicated view that filters to show only idle instances (those awaiting user input), presenting them one at a time in a card-based interface. This makes it easy to:

1. **Review** - See what each idle instance was last working on
2. **Triage** - Decide what to do next with each instance
3. **Dispatch** - Quickly send a new command or dismiss

The mobile experience uses swipe gestures (swipe right to act, swipe left to skip), while desktop uses keyboard shortcuts and click interactions.

## Requirements

### Must Have
- [ ] Filter view showing only idle instances
- [ ] One-at-a-time card presentation
- [ ] Display last terminal output/activity for context
- [ ] Quick command input to dispatch new work
- [ ] Swipe gestures on mobile (right=act, left=skip)
- [ ] Keyboard navigation on desktop (arrow keys, enter)
- [ ] Instance counter showing progress (e.g., "2 of 5")
- [ ] Exit queue mode when all instances reviewed

### Should Have
- [ ] Show recent command history for the instance
- [ ] "Skip all" option to exit queue mode
- [ ] Badge/indicator on main nav showing idle count
- [ ] Auto-enter queue mode when many instances go idle (optional setting)
- [ ] Quick action buttons (common commands, close instance)

### Out of Scope
- [ ] Task routing from Smart Tasks (separate feature)
- [ ] Multi-instance batch operations
- [ ] Instance creation from queue mode

## Technical Design

### Architecture

Queue Mode is a new view that:
1. Subscribes to the instances store, filtered to `status === 'idle'`
2. Maintains its own local state for current index and dismissed instances
3. Uses the same terminal output system to show last activity
4. Dispatches commands via existing WebSocket infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│  Queue Mode View                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Instance Card (swipeable)                          │   │
│  │                                                     │   │
│  │  [Status] instance-name              2 of 5 idle   │   │
│  │  ~/path/to/project                                  │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Last Activity Preview                       │   │   │
│  │  │  > npm test                                  │   │   │
│  │  │  ✓ All 42 tests passed                      │   │   │
│  │  │  $                                          │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │  Enter command...                      [→]  │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  [Skip]                               [Send & Next] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ← Swipe left: Skip     Swipe right: Open full terminal →  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `QueueModeView` | `client/src/components/queue/QueueModeView.tsx` | Main container, orchestrates card stack |
| `QueueCard` | `client/src/components/queue/QueueCard.tsx` | Individual instance card with gestures |
| `QueueCommandInput` | `client/src/components/queue/QueueCommandInput.tsx` | Quick command input with suggestions |
| `QueueProgress` | `client/src/components/queue/QueueProgress.tsx` | Progress indicator (X of Y) |
| `useQueueMode` | `client/src/hooks/useQueueMode.ts` | Hook for queue state and navigation |

### State Shape

```typescript
// Local component state (not global store)
interface QueueModeState {
  idleInstances: Instance[];      // Filtered from instances store
  currentIndex: number;           // Which card is showing
  skippedIds: Set<string>;        // Instances skipped this session
  commandDraft: string;           // Current command being typed
  isAnimating: boolean;           // Prevent interactions during card transition
}

// UI Store addition
interface UIState {
  // ... existing
  queueModeEnabled: boolean;      // Toggle for queue mode view
}
```

### Data Flow

1. **Enter Queue Mode**: User clicks "Review Idle" button or presses `Q` shortcut
2. **Load Instances**: Filter instances to `status === 'idle'`, excluding recently skipped
3. **Display Card**: Show first idle instance with terminal preview
4. **User Action**:
   - **Skip**: Mark as skipped, animate card left, show next
   - **Send Command**: Dispatch via WebSocket, instance becomes 'working', show next
   - **Open Full**: Navigate to full terminal view for this instance
5. **Complete**: When no more idle instances, show completion state or exit

### Swipe Gesture Specs

```typescript
const SWIPE_THRESHOLD = 100;    // pixels to trigger action
const SWIPE_VELOCITY = 500;     // px/s velocity threshold for quick swipes
const ROTATION_FACTOR = 0.1;    // degrees per pixel of drag

// Swipe directions
// Right: Open full terminal view OR send command (if drafted)
// Left: Skip to next instance
// Up: (reserved for future - maybe quick close?)
// Down: (reserved for future)
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Q` | Enter/exit queue mode |
| `←` / `J` | Skip current instance |
| `→` / `K` | Open full terminal |
| `Enter` | Send drafted command |
| `Escape` | Exit queue mode |
| `Tab` | Focus command input |

## Implementation Plan

### Phase 1: Foundation
1. Create `useQueueMode` hook with filtering logic
2. Add `queueModeEnabled` to UI store
3. Create basic `QueueModeView` container
4. Add "Review Idle" entry point to navigation

### Phase 2: Card Component
1. Create `QueueCard` with instance info display
2. Add terminal preview (last N lines of output)
3. Implement `QueueProgress` indicator
4. Add skip/action buttons

### Phase 3: Command Input
1. Create `QueueCommandInput` component
2. Wire up command dispatch to WebSocket
3. Handle instance status change (idle → working)
4. Auto-advance to next card after dispatch

### Phase 4: Gestures (Framer Motion)
1. Add swipe gesture handling to `QueueCard`
2. Implement card stack animation (next card peeks behind)
3. Add rotation on drag for natural feel
4. Spring physics for release/snap-back

### Phase 5: Polish
1. Add keyboard shortcuts
2. Add empty state (no idle instances)
3. Add completion state (all reviewed)
4. Add idle count badge to navigation
5. Mobile-specific touch optimizations

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| No idle instances | Show empty state with "All instances are busy" message |
| Instance becomes working while viewing | Auto-remove from queue, show next |
| Command dispatch fails | Show error toast, keep card visible for retry |
| All instances reviewed | Show completion message, auto-exit after 2s |
| Instance closed externally | Remove from queue silently |
| Network disconnect | Disable dispatch, show reconnecting state |

## Testing Strategy

- **Unit tests**: `useQueueMode` hook filtering and navigation logic
- **Component tests**: `QueueCard` renders correct instance data
- **E2E tests**: Complete flow from entering queue mode to dispatching command
- **Manual testing**: Swipe gestures on iOS and Android devices

## Open Questions

- [ ] Should skipped instances reset when re-entering queue mode?
- [ ] Should queue mode be accessible from mobile home view?
- [ ] Should we show a preview of the next card behind the current one?
- [ ] What happens if user has 50+ idle instances? (pagination?)

## Design Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| One card at a time | Focused decision-making, reduces cognitive load | Grid view, list view |
| Local state vs global | Queue state is ephemeral, doesn't need persistence | Zustand store |
| Swipe right = action | Matches common app patterns (Tinder, email) | Swipe right = skip |
| Show terminal preview | Provides context without full terminal overhead | Just show last command |

## Dependencies

- Framer Motion (for gestures and animations) - covered by separate plan
- Existing WebSocket infrastructure for command dispatch
- Existing terminal output subscription system

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `client/src/components/queue/QueueModeView.tsx` | Create | Main container component |
| `client/src/components/queue/QueueCard.tsx` | Create | Swipeable instance card |
| `client/src/components/queue/QueueCommandInput.tsx` | Create | Quick command input |
| `client/src/components/queue/QueueProgress.tsx` | Create | Progress indicator |
| `client/src/components/queue/index.ts` | Create | Barrel export |
| `client/src/hooks/useQueueMode.ts` | Create | Queue state hook |
| `client/src/store/uiStore.ts` | Modify | Add `queueModeEnabled` |
| `client/src/components/layout/Header.tsx` | Modify | Add queue mode entry point |
| `client/src/components/mobile/MobileLayout.tsx` | Modify | Add queue mode button |
| `client/src/App.tsx` or router | Modify | Add queue mode route/view |

---

*Created: January 2025*
