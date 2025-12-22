import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface EditableNameProps {
  value: string;
  onSave: (newValue: string) => void;
  className?: string;
  isEditing?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

export function EditableName({
  value,
  onSave,
  className = '',
  isEditing: externalIsEditing,
  onEditStart,
  onEditEnd,
}: EditableNameProps) {
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use external control if provided, otherwise internal state
  const isEditing = externalIsEditing ?? internalIsEditing;

  useEffect(() => {
    if (isEditing) {
      setEditValue(value);
      // Focus and select all text
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isEditing, value]);

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== value) {
      onSave(trimmedValue);
    }
    if (externalIsEditing === undefined) {
      setInternalIsEditing(false);
    }
    onEditEnd?.();
  };

  const handleCancel = () => {
    setEditValue(value);
    if (externalIsEditing === undefined) {
      setInternalIsEditing(false);
    }
    onEditEnd?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleDoubleClick = () => {
    if (externalIsEditing === undefined) {
      setInternalIsEditing(true);
    }
    onEditStart?.();
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`bg-surface-700 border border-accent rounded px-2 py-0.5 text-theme-primary outline-none ${className}`}
      />
    );
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className={`cursor-default select-none ${className}`}
      title="Double-click to rename"
    >
      {value}
    </span>
  );
}
