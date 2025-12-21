# Instance Renaming Implementation Plan

## Overview

Allow users to rename instances for easy identification via inline editing.

## Trigger Mechanism

**Double-click to edit** (recommended)
- Familiar pattern (file managers, spreadsheets)
- No additional UI clutter
- Single click remains for selection

## State Management

```javascript
const [editingInstanceId, setEditingInstanceId] = useState(null);
const [editingName, setEditingName] = useState('');
const [instances, setInstances] = useState(mockInstances);

const startEditing = (instanceId, currentName) => {
  setEditingInstanceId(instanceId);
  setEditingName(currentName);
};

const cancelEditing = () => {
  setEditingInstanceId(null);
  setEditingName('');
};

const confirmRename = (instanceId) => {
  const trimmedName = editingName.trim();
  if (validateName(trimmedName)) {
    setInstances(prev => prev.map(inst =>
      inst.id === instanceId ? { ...inst, name: trimmedName } : inst
    ));
  }
  cancelEditing();
};

const validateName = (name) => {
  if (!name || name.length === 0) return false;
  if (name.length > 32) return false;
  return /^[a-zA-Z0-9_-]+$/.test(name);
};
```

## EditableName Component

```javascript
const EditableName = ({
  instance, isEditing, editingName,
  onStartEdit, onNameChange, onConfirm, onCancel,
  className = ''
}) => {
  const inputRef = React.useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editingName}
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onConfirm}
        onClick={(e) => e.stopPropagation()}
        maxLength={32}
        className={`
          bg-surface-900 border border-accent rounded px-2 py-0.5
          text-white font-semibold outline-none
          focus:ring-2 focus:ring-accent/50 ${className}
        `}
        style={{ width: `${Math.max(editingName.length, 8)}ch` }}
      />
    );
  }

  return (
    <span
      className={`font-semibold cursor-text ${className}`}
      onDoubleClick={(e) => { e.stopPropagation(); onStartEdit(); }}
      title="Double-click to rename"
    >
      {instance.name}
    </span>
  );
};
```

## Validation Rules

| Rule | Constraint | Error |
|------|------------|-------|
| Not empty | `name.trim().length > 0` | "Name cannot be empty" |
| Max length | `name.length <= 32` | "Name must be 32 characters or less" |
| Valid characters | `/^[a-zA-Z0-9_-]+$/` | "Only letters, numbers, hyphens, underscores" |

## Keyboard Interactions

| Key | Action |
|-----|--------|
| Enter | Confirm rename (if valid) |
| Escape | Cancel editing, restore original |

## Layout Updates

All layouts (TabBarLayout, CardLayout, ListLayout, TerminalView header) replace static name `<span>` with:

```javascript
<EditableName
  instance={instance}
  isEditing={editingInstanceId === instance.id}
  editingName={editingName}
  onStartEdit={() => startEditing(instance.id, instance.name)}
  onNameChange={setEditingName}
  onConfirm={() => confirmRename(instance.id)}
  onCancel={cancelEditing}
/>
```

## Implementation Steps

1. Add state variables (`editingInstanceId`, `editingName`)
2. Convert `instances` to mutable state
3. Implement `validateName()` function
4. Create `EditableName` component
5. Implement `startEditing`, `cancelEditing`, `confirmRename`
6. Update TabBarLayout
7. Update CardLayout
8. Update ListLayout
9. Update TerminalView header
10. Add input styling CSS

## Edge Cases

- Blur confirms rename (if valid) or cancels
- Layout switch during edit: cancel edit
- Empty name: restore original
- Very long names: input scrolls, display truncates
