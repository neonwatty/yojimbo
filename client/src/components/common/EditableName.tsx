import { useEffect, useRef } from 'react';

interface EditableNameProps {
  name: string;
  isEditing: boolean;
  editingValue: string;
  onStartEdit: () => void;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

export function EditableName({
  name,
  isEditing,
  editingValue,
  onStartEdit,
  onValueChange,
  onConfirm,
  onCancel,
  className = '',
}: EditableNameProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editingValue}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onConfirm}
        onClick={(e) => e.stopPropagation()}
        maxLength={32}
        className={`bg-surface-900 border border-accent rounded px-2 py-0.5
          text-theme-primary font-semibold outline-none
          focus:ring-2 focus:ring-accent/50 ${className}`}
        style={{ width: `${Math.max(editingValue.length, 8)}ch` }}
      />
    );
  }

  return (
    <span
      className={`font-semibold cursor-text hover:text-accent-bright transition-colors ${className}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onStartEdit();
      }}
      title="Double-click to rename"
    >
      {name}
    </span>
  );
}
