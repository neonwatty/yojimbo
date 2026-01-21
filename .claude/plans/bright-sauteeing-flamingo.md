# Simplify Queue Mode: Navigate Actual Instances

## Problem

Current Queue Mode is overly complicated:
- Has its own WebSocket connection for terminal communication
- `TerminalPreview` component subscribes to terminal output
- `QueueCommandInput` for sending commands
- Activity detection, ANSI stripping, etc.
- Tries to recreate terminal functionality in a mini-widget
- Communication between the Queue Mode widget and actual instances is fragile

**User's request**: Simplify Queue Mode to just cycle through actual idle instances.

## New Design: Queue Mode as Navigation Aid

Instead of a separate view with its own terminal widget, Queue Mode becomes a **navigation overlay** on top of the actual instance view:

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────────┐ │
│ │  ◀ 2 of 5 idle                  [Skip] [Next ▶] [✕ Exit] │ │ ← Queue Mode Overlay
│ └──────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │                                                          │ │
│ │                                                          │ │
│ │              ACTUAL INSTANCE TERMINAL                    │ │
│ │              (Full functionality)                        │ │
│ │                                                          │ │
│ │                                                          │ │
│ └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  Keyboard: ← Skip to next • → Go to next • Esc Exit queue   │
└──────────────────────────────────────────────────────────────┘
```

### Flow

1. **Enter Queue Mode**: Press `q` or click "Review Idle"
2. **Navigate to first idle instance**: Automatically go to `/instances/{first-idle-id}`
3. **Show overlay**: Display "Queue Mode: X of Y idle" banner with navigation
4. **User works in real terminal**: Full terminal functionality, no widget
5. **Navigate**: Press `←` to skip, `→` to go next, `Esc` to exit
6. **Complete**: When all idle instances reviewed, exit queue mode

### Benefits
- **Real terminal**: User works in actual instance view, no communication layer
- **Simpler code**: Remove ~400 lines of terminal preview/command input code
- **Reliable**: No WebSocket subscription issues, activity detection complexity
- **Familiar UX**: Same interface they use normally, just with navigation overlay

## Files to Delete

| File | Reason |
|------|--------|
| `client/src/components/queue/TerminalPreview.tsx` | No longer needed - use real terminal |
| `client/src/components/queue/QueueCommandInput.tsx` | No longer needed - use real terminal |
| `client/src/components/queue/QueueCard.tsx` | No longer needed - navigate to real instance |
| `client/src/components/queue/QueueProgress.tsx` | Move to overlay |

## Files to Modify

| File | Changes |
|------|---------|
| `client/src/components/queue/QueueModeView.tsx` | **Simplify dramatically** - just redirect to first idle instance |
| `client/src/components/queue/index.ts` | Update exports |
| `client/src/hooks/useQueueMode.ts` | Simplify - just track current index and provide navigation |
| `client/src/pages/InstancesPage.tsx` | Add QueueModeOverlay when queue mode is active |
| `client/src/store/uiStore.ts` | Add `queueModeActive` state |

## Files to Create

| File | Description |
|------|-------------|
| `client/src/components/queue/QueueModeOverlay.tsx` | Small banner overlay for navigation |

## Implementation Plan

### Phase 1: Create QueueModeOverlay Component

A simple overlay bar that shows:
- Current position: "2 of 5 idle"
- Navigation buttons: Skip, Next, Exit
- Keyboard hint at bottom

```tsx
// QueueModeOverlay.tsx
export function QueueModeOverlay({
  current,
  total,
  onSkip,
  onNext,
  onExit
}: QueueModeOverlayProps) {
  return (
    <div className="absolute top-0 left-0 right-0 bg-surface-800 border-b border-surface-600 px-4 py-2 z-50">
      <div className="flex items-center justify-between">
        <span className="text-sm text-theme-secondary">
          Queue Mode: {current} of {total} idle
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onSkip}>← Skip</button>
          <button onClick={onNext}>Next →</button>
          <button onClick={onExit}>✕ Exit</button>
        </div>
      </div>
    </div>
  );
}
```

### Phase 2: Simplify useQueueMode Hook

Remove terminal subscription logic, keep only:
- Filter idle instances
- Track current index
- Skip/next navigation
- Reset functionality

### Phase 3: Simplify QueueModeView

Instead of rendering a card with terminal preview, just:
1. Get first idle instance
2. Navigate to `/instances/{id}`
3. Set queue mode active in UI store

```tsx
// Simplified QueueModeView.tsx
export function QueueModeView() {
  const { idleInstances, currentIndex } = useQueueMode();
  const navigate = useNavigate();
  const setQueueModeActive = useUIStore(s => s.setQueueModeActive);

  useEffect(() => {
    if (idleInstances.length > 0) {
      setQueueModeActive(true);
      navigate(`/instances/${idleInstances[currentIndex].id}`);
    }
  }, [idleInstances, currentIndex]);

  // Empty state if no idle instances
  if (idleInstances.length === 0) {
    return <EmptyState />;
  }

  return null; // Redirect happens, nothing to render
}
```

### Phase 4: Integrate Overlay into InstancesPage

When viewing an instance and queue mode is active, show the overlay:

```tsx
// In InstancesPage.tsx
const queueModeActive = useUIStore(s => s.queueModeActive);

return (
  <div className="relative">
    {queueModeActive && (
      <QueueModeOverlay
        current={currentIndex + 1}
        total={totalIdle}
        onSkip={handleSkip}
        onNext={handleNext}
        onExit={handleExitQueue}
      />
    )}
    {/* ... rest of instance view */}
  </div>
);
```

### Phase 5: Delete Unused Files & Cleanup

Remove:
- TerminalPreview.tsx
- QueueCommandInput.tsx
- QueueCard.tsx
- QueueProgress.tsx (or repurpose for overlay)
- Related WebSocket subscription code
- terminal-activity.service.ts (from previous PR)

## Verification

1. Press `q` to enter queue mode
2. Verify: Automatically navigates to first idle instance
3. Verify: Overlay shows "1 of X idle"
4. Verify: Real terminal is fully functional (type commands, see output)
5. Press `→` to go to next idle instance
6. Press `Esc` to exit queue mode
7. Verify: Overlay disappears, normal instance view

## Mobile Design

On mobile, the overlay and interaction changes:

### Mobile Overlay (Compact)
```
┌──────────────────────────────┐
│ ● 2/5 idle              [✕] │
└──────────────────────────────┘
```

### Mobile Navigation (Swipe Gestures)
- **Swipe left**: Skip to next instance
- **Swipe right**: Go to next instance
- **Tap X**: Exit queue mode

### Mobile Footer Hints
```
┌──────────────────────────────┐
│  👈 Swipe left   │   Swipe right 👉  │
│     Skip         │      Next         │
└──────────────────────────────┘
```

### Card Stack Animation (Mobile)
When swiping, show a "card stack" effect where:
- Current instance card animates out (transforms + rotates slightly)
- Next instance card peeks from behind (scaled down, slightly offset)
- Progress dots at bottom show position in queue

## Files to Modify for Mobile

| File | Changes |
|------|---------|
| `client/src/components/queue/QueueModeOverlay.tsx` | Responsive design - compact on mobile |
| `client/src/pages/InstancesPage.tsx` | Add touch/swipe gesture handlers |
| `client/src/components/mobile/MobileLayout.tsx` | Support queue mode overlay |

## Mockup

Created `mockups/queue-mode-simplified.html` showing:
1. **Desktop**: Instance view with overlay banner, keyboard shortcuts
2. **Desktop**: Navigating between instances
3. **Desktop**: Complete state, Empty state
4. **Mobile**: Compact overlay with swipe hints
5. **Mobile**: Card stack swipe animation
