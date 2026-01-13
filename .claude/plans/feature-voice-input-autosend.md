# Feature: Voice Input Auto-Send

> One-tap voice input with automatic send after silence detection, eliminating multiple button presses for speech-to-text workflows.

## Summary

Currently, mobile users using third-party speech-to-text apps like Whispr Flow face a cumbersome multi-step workflow: tap mic FAB → wait for expansion → wait for Whispr Flow to activate → speak → manually tap Send+Enter. This creates significant friction for what should be a quick voice-to-command interaction.

This feature streamlines the flow to: tap mic → speak → see text → auto-send. By detecting when text input stops changing (silence detection via debounce), we can automatically trigger the send action, reducing the interaction to a single tap followed by natural speech.

The existing expanded input mode remains accessible via long-press for users who want to review and edit before sending.

## Requirements

### Must Have
- [ ] Tap mic FAB → expand + auto-focus textarea immediately
- [ ] Auto-send with Enter after text stops changing for 2.5 seconds
- [ ] Visual indicator showing auto-send is pending (pulsing mic or countdown)
- [ ] Tap collapse button cancels auto-send and closes input
- [ ] Empty text at timeout → cancel silently (no send)

### Should Have
- [ ] Long-press mic FAB → expand in manual mode (no auto-send)
- [ ] Tapping textarea while text exists → cancel auto-send (switch to manual)
- [ ] Subtle animation/feedback during countdown

### Out of Scope
- Integration with specific speech-to-text apps (Whispr Flow handles its own activation)
- Configurable timeout duration (hardcode 2.5s for v1)
- Desktop support (mobile-only feature)

## Technical Design

### Architecture

The feature modifies `MobileTextInput.tsx` to add:
1. Auto-send mode state (vs manual mode)
2. Debounced timer on text changes
3. Long-press detection on mic FAB
4. Visual feedback during pending auto-send

```
User Flow:
┌─────────────────────────────────────────────────────────────┐
│ TAP mic FAB                                                  │
│    ↓                                                        │
│ Expand input + focus textarea (auto-send mode ON)           │
│    ↓                                                        │
│ Whispr Flow types text → onChange fires → reset 2.5s timer  │
│    ↓                                                        │
│ Text stops changing for 2.5s                                │
│    ↓                                                        │
│ Timer fires → if text exists, sendWithEnter() → collapse    │
└─────────────────────────────────────────────────────────────┘

Cancel paths:
- Tap collapse button → cancel timer, close input
- Tap textarea (with text) → cancel timer, switch to manual mode
- Empty text when timer fires → cancel silently
```

### Key Components

**MobileTextInput.tsx** - Modified
- Add `isAutoSendMode` state
- Add `autoSendTimerRef` for debounce timer
- Add long-press handler for mic FAB
- Add visual indicator for pending auto-send
- Modify `handleExpand` to accept mode parameter

### State Changes

```typescript
// New state
const [isAutoSendMode, setIsAutoSendMode] = useState(false);
const autoSendTimerRef = useRef<NodeJS.Timeout | null>(null);

// Timer logic
const AUTO_SEND_DELAY = 2500; // 2.5 seconds

const startAutoSendTimer = useCallback(() => {
  if (autoSendTimerRef.current) {
    clearTimeout(autoSendTimerRef.current);
  }
  autoSendTimerRef.current = setTimeout(() => {
    if (text.trim() && isAutoSendMode) {
      handleSendWithEnter();
      handleCollapse();
    }
  }, AUTO_SEND_DELAY);
}, [text, isAutoSendMode, handleSendWithEnter, handleCollapse]);
```

## Implementation Plan

### Phase 1: Core Auto-Send Logic
1. Add `isAutoSendMode` state and `autoSendTimerRef`
2. Create `startAutoSendTimer` and `cancelAutoSendTimer` functions
3. Wire `onChange` to reset timer when in auto-send mode
4. Trigger `handleSendWithEnter()` + `handleCollapse()` when timer fires

### Phase 2: Entry Points
1. Modify mic FAB tap → set `isAutoSendMode = true`, expand, focus
2. Add long-press handler → set `isAutoSendMode = false`, expand, focus
3. Ensure collapse clears timer and resets mode

### Phase 3: Cancel Behaviors
1. Collapse button → cancel timer, close input
2. Textarea tap (when text exists) → cancel timer, set manual mode
3. Empty text on timer fire → cancel silently

### Phase 4: Visual Feedback
1. Add pulsing animation to mic icon when auto-send is pending
2. Show subtle indicator (dot or ring) on expanded input during countdown
3. Ensure animations are performant (CSS-only where possible)

### Phase 5: Testing & Polish
1. Test with Whispr Flow on iOS
2. Test edge cases (rapid typing, empty input, manual cancel)
3. Verify long-press doesn't interfere with tap
4. Test that terminal scrolling still works

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Empty text when timer fires | Cancel silently, stay in expanded mode |
| User taps textarea during countdown | Cancel timer, switch to manual mode |
| User taps collapse during countdown | Cancel timer, collapse immediately |
| Rapid text changes (fast typing) | Each change resets timer, only fires after 2.5s pause |
| User long-presses mic | Open in manual mode (no auto-send) |
| Text sent successfully | Collapse input, clear text |
| Network error on send | Show error (existing behavior), stay open |

## Testing Strategy

- Manual testing with Whispr Flow on iOS device
- Unit tests for:
  - Timer start/reset/cancel logic
  - Mode switching (auto → manual)
  - Long-press detection
- Verify no regression on:
  - Manual send buttons still work
  - Terminal scrolling not affected
  - Collapse behavior unchanged

## Open Questions

- [ ] What's the ideal timeout duration? Starting with 2.5s, may need adjustment based on real usage
- [ ] Should there be haptic feedback when auto-send triggers?
- [ ] Should we persist the last-used mode preference?

## Design Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| 2.5s timeout | Balances responsiveness vs giving time for speech pauses | 2s (too fast), 3s (too slow) |
| Debounce on text change | Works with any STT app that types into field | Could use SpeechRecognition API (not cross-platform) |
| Long-press for manual mode | Intuitive gesture, doesn't add UI clutter | Settings toggle, mode button |
| Collapse after send | Matches "quick interaction" mental model | Stay open for continued input |
| Cancel on textarea tap | Natural "I want to edit" gesture | Explicit cancel button |
