# Bug: Mobile Terminal Scroll Not Working

> Swipe gestures to scroll the xterm.js terminal on mobile are completely unresponsive—users are stuck at the bottom of terminal output.

## Summary

**Reported:** 2026-01-09
**Severity:** High
**Affected:** Mobile users (iOS), all instances with terminal output

When viewing a Claude Code instance on mobile, users cannot scroll the terminal output using standard swipe gestures. The terminal appears completely unresponsive to touch scroll attempts—no bounce effect, no partial scroll, nothing. This prevents users from reviewing earlier output in the terminal, significantly degrading the mobile experience.

The issue occurs from the moment the instance is created, regardless of how much content is in the terminal. Other touch gestures in the app work correctly (edge swipes reveal menus), suggesting this is specific to the terminal component rather than a global touch handling issue.

## Reproduction Steps

1. Open the app on an iOS mobile device (Safari or PWA)
2. Create or navigate to a Claude Code instance
3. Wait for any terminal output to appear
4. Attempt to scroll up in the terminal by swiping up on the terminal area
5. Observe that nothing happens—scroll position remains at bottom

**Expected:** Terminal scrolls up to show earlier output, with standard iOS momentum scrolling

**Actual:** No response to swipe gesture—terminal remains stuck at bottom

**Frequency:** Always (100% reproducible)

**Workaround:** None known

## Environment

- **Browsers:** iOS Safari, PWA (to be confirmed which is affected)
- **Devices:** iPhone (all models, iOS)
- **Terminal Library:** xterm.js
- **Other gestures:** Working (edge swipes reveal menus correctly)

## Investigation Plan

### Phase 1: Confirm & Isolate

1. [ ] Reproduce locally in iOS Simulator
2. [ ] Test in Safari browser vs installed PWA
3. [ ] Test swipe starting from CENTER of terminal (far from edges)
4. [ ] Check Safari Web Inspector console for errors during swipe attempts
5. [ ] Verify other scrollable areas in app work (activity feed, settings)

### Phase 2: Locate Root Cause

1. [ ] Inspect computed CSS on terminal container:
   - Check for `touch-action: none` or `touch-action: pan-x`
   - Check for `overflow: hidden` preventing scroll
   - Check for `pointer-events: none`
   - Check for missing `-webkit-overflow-scrolling: touch`

2. [ ] Review xterm.js initialization:
   - Check if touch/mobile scrolling options are enabled
   - Look for any explicit touch event handling
   - Check viewport addon configuration

3. [ ] Audit touch event handlers:
   - Search for `touchstart`, `touchmove`, `touchend` listeners
   - Look for `preventDefault()` calls on touch events
   - Check if gesture recognizer for menus conflicts with terminal area

4. [ ] Test xterm.js in isolation:
   - Create minimal reproduction with just xterm.js
   - Verify xterm.js touch scrolling works without app wrapper

### Phase 3: Fix & Verify

1. [ ] Implement fix based on root cause findings
2. [ ] Verify fix on iOS Simulator (iPhone 16)
3. [ ] Test on physical iOS device
4. [ ] Verify menu edge swipes still work correctly
5. [ ] Test with various content amounts (minimal and large output)

## Hypotheses

| Theory | Evidence For | Evidence Against | Test |
|--------|--------------|------------------|------|
| CSS `touch-action` blocking scrolls | Completely dead response typical of CSS blocking | Other gestures work | Inspect computed styles on terminal container |
| xterm.js touch not configured | xterm.js needs explicit mobile config | Would expect some response | Check xterm initialization options |
| Event handler `preventDefault()` | Dead response, no iOS bounce | Other areas of app work | Review touch handlers, check event propagation |
| Menu gesture recognizer conflict | Edge swipes work, terminal doesn't | Menus "only trigger from edges" | Test center-of-screen swipes specifically |
| Overlay blocking touches | Dead response to all touch | Some gestures work | Inspect DOM layers, z-index stacking |

## Affected Code

Files likely involved:
- Terminal component initialization (xterm.js setup)
- Terminal container CSS/styles
- Touch/gesture handling code
- Mobile-specific layout or wrapper components

## Testing Strategy

- [ ] Verify terminal scrolling works on iOS after fix
- [ ] Test on multiple iPhone sizes (SE, standard, Pro Max)
- [ ] Confirm edge swipe menus still function
- [ ] Test with minimal content (few lines)
- [ ] Test with large content (hundreds of lines)
- [ ] Verify no regression on desktop behavior
- [ ] Test in both Safari browser and PWA modes

## Open Questions

- [ ] Has terminal scrolling EVER worked on mobile? (regression vs never implemented)
- [ ] Are there any xterm.js addons being used for touch support?
- [ ] What's in the console when attempting to scroll?
- [ ] Is this iOS-specific or also affects Android?
- [ ] Do center-of-terminal swipes behave differently than near-edge swipes?

## Fix Implemented

**Status:** ✅ VERIFIED WORKING (2026-01-09)

**Root Cause:** xterm.js does NOT natively support touch scrolling on mobile. This is a [known limitation](https://github.com/xtermjs/xterm.js/issues/5377) - the library's architecture has the viewport underneath the row divs, so touch/ballistic scrolling doesn't work out of the box.

**Changes Made:**

1. **`client/src/hooks/useTerminal.ts:110-154`** (PRIMARY FIX)
   - Added custom touch event handlers for mobile scrolling
   - Listens to `touchstart`, `touchmove`, `touchend` on `.xterm-screen` element
   - Calculates scroll delta based on finger movement
   - Calls `terminal.scrollLines()` to scroll the terminal programmatically

2. **`client/src/styles/globals.css:691-734`** (CSS Support)
   - Changed `touch-action: none` to `touch-action: pan-y` on `html`, `body`, and `#root`
   - Added `.xterm` and `.xterm-viewport` rules with `touch-action: pan-y !important`
   - Added `-webkit-overflow-scrolling: touch` for iOS momentum scrolling

3. **`client/src/components/mobile/MobileLayout.tsx:743`**
   - Added `style={{ touchAction: 'pan-y' }}` to terminal wrapper

4. **`client/src/components/terminal/Terminal.tsx:128-132`**
   - Added `touchAction: 'pan-y'` to style prop

**Why this works:** The CSS changes (`touch-action: pan-y`) allow touch events to reach the terminal element instead of being blocked at the root level. The JavaScript touch event handlers then intercept these events and translate finger movement into xterm.js scroll commands using `terminal.scrollLines()`.

## Verification Results

Tested on iOS Simulator (iPhone 16) on 2026-01-09:

- [x] Terminal scrolling works with swipe gestures (up and down)
- [x] Top edge swipe opens settings/navigation drawer
- [x] Bottom edge swipe opens instances drawer
- [x] Center-of-screen swipes scroll terminal (don't trigger drawers)
- [x] Can scroll to see earlier terminal content
- [x] Can scroll back to bottom

## Remaining Testing

- [ ] Test on physical iOS device
- [ ] Test on multiple iPhone sizes (SE, standard, Pro Max)
- [ ] Test in PWA mode (installed to home screen)
- [ ] Verify no regression on desktop behavior
- [ ] Test on Android devices
