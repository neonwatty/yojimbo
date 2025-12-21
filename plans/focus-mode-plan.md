# Focus Mode Implementation Plan

## Overview

Focus Mode is a behavioral enhancement that allows users to expand a single terminal instance for detailed viewing while maintaining visibility of other instances as thumbnails. Works within existing layouts (tabs, cards, list) rather than being a separate layout mode.

## State Management

```javascript
const [focusedInstance, setFocusedInstance] = useState(null);  // ID or null
```

- `focusedInstance === null` → normal view
- `focusedInstance === 'id'` → that instance is expanded
- Independent of `activeInstance` (active = keyboard input, focused = visual expansion)

## Trigger Mechanisms

**Enter Focus Mode:**
1. Double-click on any instance
2. Expand button (diagonal arrows) visible on hover
3. Enter key when instance is selected

**Exit Focus Mode:**
1. Click outside the focused terminal (on overlay/thumbnails)
2. Escape key
3. Collapse button in focused view header
4. Double-click focused instance again (toggle)

## Visual Treatment

**Focused Instance:**
- Expands to ~70-75% of content area
- Full TerminalView with complete output
- Header with name, status, working directory, collapse button
- Elevated: `shadow-2xl`, `ring-2 ring-accent`

**Thumbnails:**
- Reduced size, arranged in strip
- Show: status dot, name, single line of output
- Dimmed: `opacity-75 hover:opacity-100`
- Clickable to switch focus
- Height: ~60-80px

**Overlay:**
- `bg-surface-900/50` behind focused instance
- Click to exit focus mode

## Layout-Specific Behavior

### Tabs Layout
```
+--[tab1][tab2][tab3][tab4]--+
|                     |thumb|
|  FOCUSED INSTANCE   |thumb|
|  (Terminal View)    |thumb|
+----------------------------|
```
- Tab bar remains at top
- Thumbnails in right sidebar (200-250px width)

### Cards Layout
```
+---------------------------+
|                    |thumb |
|  FOCUSED CARD      |thumb |
|  (Full Terminal)   |thumb |
+---------------------------+
```
- Focused card takes 70% width
- Thumbnails stack vertically on right

### List Layout
```
+--[t1]-[t2]-[t3]-[t4]-[t5]--+
|                            |
|   FOCUSED INSTANCE         |
|   (Full Terminal View)     |
+----------------------------+
```
- Horizontal thumbnail strip at top
- Focused instance expands below

## CSS Animations

```css
@keyframes focusExpand {
  from { opacity: 0.8; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes focusShrink {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0.9; transform: scale(0.98); }
}

.focus-transition {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

## New Components

1. **ExpandButton** - expand/collapse icon button
2. **ThumbnailInstance** - compact instance representation
3. **FocusOverlay** - backdrop with click-outside handling
4. **FocusedTerminalView** - enhanced TerminalView with collapse button

## Event Handlers

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && focusedInstance) {
      setFocusedInstance(null);
    }
    if (e.key === 'Enter' && activeInstance && !focusedInstance) {
      setFocusedInstance(activeInstance);
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [focusedInstance, activeInstance]);
```

## Implementation Steps

1. Add `focusedInstance` state and keyboard handlers to App
2. Create ExpandButton, ThumbnailInstance, FocusOverlay components
3. Add CSS animations
4. Modify TabBarLayout for focus mode (thumbnail sidebar)
5. Modify CardLayout for focus mode (grid transformation)
6. Modify ListLayout for focus mode (horizontal strip)
7. Create FocusedTerminalView component
8. Update App render logic for conditional focus overlay

## Edge Cases

- No instances: focus mode disabled
- Single instance: focus works, no thumbnails shown
- Instance removed while focused: exit focus mode
- Layout change while focused: maintain focus, adapt visualization
