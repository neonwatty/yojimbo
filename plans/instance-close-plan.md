# Instance Close/Remove Implementation Plan

## Overview

Allow users to close/remove instances from the orchestrator.

## Trigger Mechanism

**X button with hover reveal** (recommended)
- Consistent with browser tab UX
- Hidden by default, visible on hover
- Uses `group-hover` pattern

## CloseButton Component

```javascript
const CloseButton = ({ onClick, className = '' }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`p-1 rounded transition-colors text-gray-500
                hover:text-red-400 hover:bg-red-400/10 ${className}`}
    aria-label="Close instance"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  </button>
);
```

## Confirmation Dialog

**Conditional confirmation based on state:**
- `working`: Always confirm (actively processing)
- `awaiting`: Always confirm (input pending)
- `error`: Always confirm (user may want to review)
- `idle`: No confirmation needed
- `pinned`: Always confirm regardless of status

```javascript
const ConfirmDialog = ({ isOpen, onConfirm, onCancel, instance }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-700 rounded-xl p-6 max-w-md shadow-2xl border border-surface-600">
        <h3 className="text-lg font-semibold mb-2">Close Instance</h3>
        <p className="text-gray-400 mb-6">
          "{instance.name}" is {instance.status}. Are you sure?
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-600">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30">
            Close Instance
          </button>
        </div>
      </div>
    </div>
  );
};
```

## Animation

```css
@keyframes slideOut {
  from { opacity: 1; transform: translateX(0) scale(1); }
  to { opacity: 0; transform: translateX(-12px) scale(0.95); }
}

.animate-out {
  animation: slideOut 0.25s ease-in forwards;
  pointer-events: none;
}
```

## State Management

```javascript
const [instances, setInstances] = useState(mockInstances);
const [closeConfirmation, setCloseConfirmation] = useState(null);

const requestClose = (instance) => {
  const needsConfirmation =
    instance.status === 'working' ||
    instance.status === 'awaiting' ||
    instance.status === 'error' ||
    instance.pinned;

  if (needsConfirmation) {
    setCloseConfirmation({ instance, isOpen: true });
  } else {
    handleCloseInstance(instance.id);
  }
};

const handleCloseInstance = (instanceId) => {
  const instanceIndex = instances.findIndex(i => i.id === instanceId);
  const wasActive = activeInstance === instanceId;

  // Apply closing animation
  setInstances(prev => prev.map(i =>
    i.id === instanceId ? { ...i, isClosing: true } : i
  ));

  // After animation, remove and update selection
  setTimeout(() => {
    setInstances(prev => {
      const remaining = prev.filter(i => i.id !== instanceId);

      if (wasActive && remaining.length > 0) {
        const newActiveIndex = Math.max(0, instanceIndex - 1);
        setActiveInstance(remaining[Math.min(newActiveIndex, remaining.length - 1)].id);
      } else if (remaining.length === 0) {
        setActiveInstance(null);
      }

      return remaining;
    });
  }, 250);
};
```

## Layout Updates

### TabBarLayout
```javascript
<button className={`group ... ${instance.isClosing ? 'animate-out' : ''}`}>
  ...
  <CloseButton
    onClick={() => requestClose(instance)}
    className="ml-1 opacity-0 group-hover:opacity-100"
  />
</button>
```

### CardLayout
```javascript
<div className={`group relative ... ${instance.isClosing ? 'animate-out' : ''}`}>
  <CloseButton
    onClick={() => requestClose(instance)}
    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100"
  />
  ...
</div>
```

### ListLayout
```javascript
<div className={`group ... ${instance.isClosing ? 'animate-out' : ''}`}>
  ...
  <CloseButton
    onClick={() => requestClose(instance)}
    className="opacity-0 group-hover:opacity-100"
  />
</div>
```

## Empty State

```javascript
const EmptyState = () => (
  <div className="flex-1 flex items-center justify-center bg-surface-800">
    <div className="text-center text-gray-500">
      <svg className="w-16 h-16 mx-auto mb-4" ...>...</svg>
      <h3 className="text-lg font-medium text-gray-400 mb-2">No Instances</h3>
      <p className="text-sm">Create a new instance to get started</p>
    </div>
  </div>
);
```

## Selection Logic When Active Closed

1. If closed was NOT active: no change
2. If closed WAS active:
   - Select previous instance in list
   - If no previous, select first remaining
   - If none remain, set `activeInstance` to null

## Implementation Steps

1. Create CloseButton component
2. Add to all layouts with `group-hover` visibility
3. Update `instances` state to be mutable
4. Implement `handleCloseInstance` with selection logic
5. Create ConfirmDialog component
6. Add `closeConfirmation` state
7. Implement `requestClose` with conditional confirmation
8. Add slideOut CSS animation
9. Add `isClosing` flag support
10. Create EmptyState component
