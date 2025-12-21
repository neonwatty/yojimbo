# Interactive Pinning Implementation Plan

## Overview

Make pinning fully interactive - currently displays static ★ but can't be toggled.

## Current State

- `mockInstances` has `pinned: boolean` property
- Unused `PinIcon` component exists (lines 231-240)
- Layouts display `★` character for pinned instances
- State is immutable: `const [instances] = useState(mockInstances)` (no setter)

## Design Decisions

### Interaction: Click to Toggle
- Direct click on star icon toggles pin state
- Matches familiar patterns (Gmail stars, browser bookmarks)
- Works on all devices (no right-click needed)

### Sorting: Pinned First
```javascript
const sortedInstances = [...instances].sort((a, b) => {
  if (a.pinned && !b.pinned) return -1;
  if (!a.pinned && b.pinned) return 1;
  return 0;
});
```

## State Management

```javascript
const [instances, setInstances] = useState(mockInstances);

const togglePin = (instanceId) => {
  setInstances(prev => prev.map(instance =>
    instance.id === instanceId
      ? { ...instance, pinned: !instance.pinned }
      : instance
  ));
};
```

## Enhanced PinIcon Component

```javascript
const PinIcon = ({ pinned, onClick, size = 'md' }) => {
  const sizeClasses = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`
        p-1 rounded transition-all duration-200
        transform hover:scale-110 active:scale-95
        ${pinned ? 'text-accent hover:text-accent-bright' : 'text-gray-500 hover:text-gray-300'}
      `}
      title={pinned ? 'Unpin instance' : 'Pin instance'}
    >
      <svg className={sizeClasses[size]} viewBox="0 0 24 24"
           fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
      </svg>
    </button>
  );
};
```

## CSS Animations

```css
@keyframes pin-bounce {
  0% { transform: scale(1); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

.instance-item {
  transition: transform 0.3s ease-out, opacity 0.3s ease-out;
}
```

## Layout Updates

### TabBarLayout
- Star icon visible on all tabs (not just pinned)
- Click star toggles without selecting tab
- Pass `onTogglePin={togglePin}` prop

### CardLayout
- Star icon in card header, always visible
- Pinned cards sort to top-left

### ListLayout
- Star icon in dedicated column before name
- Pinned items at top of list

## Header Enhancement

```javascript
<div className="text-xs text-gray-500 font-mono">
  {instances.length} instances
  {instances.filter(i => i.pinned).length > 0 &&
    <span className="ml-2 text-accent">
      ({instances.filter(i => i.pinned).length} pinned)
    </span>
  }
</div>
```

## Implementation Steps

1. Add setter to instances state
2. Create `togglePin` function
3. Create `sortedInstances` computed value
4. Update PinIcon component with star polygon icon
5. Add CSS animations
6. Update TabBarLayout with PinIcon and onTogglePin
7. Update CardLayout with PinIcon and onTogglePin
8. Update ListLayout with PinIcon and onTogglePin
9. Update header to show pinned count

## Testing Checklist

- [ ] Click star toggles pin state in all layouts
- [ ] Pinned instances sort to front immediately
- [ ] Click on star does not trigger instance selection
- [ ] Pin state persists when switching layouts
- [ ] Scale animation on click is smooth
