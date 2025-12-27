import { useState, memo } from 'react';
import type { Instance } from '@cc-orchestrator/shared';
import { StatusDot, StatusBadge } from '../common/Status';
import { EditableName } from '../common/EditableName';
import { Icons } from '../common/Icons';

interface ListLayoutProps {
  instances: Instance[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClose: (instance: Instance) => void;
  onExpand: (id: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  editingId: string | null;
  editingName: string;
  onStartEditing: (id: string, name: string) => void;
  onEditingNameChange: (name: string) => void;
  onConfirmRename: (id: string) => void;
  onCancelEditing: () => void;
}

export const ListLayout = memo(function ListLayout({
  instances,
  activeId,
  onSelect,
  onTogglePin,
  onClose,
  onExpand,
  onReorder,
  editingId,
  editingName,
  onStartEditing,
  onEditingNameChange,
  onConfirmRename,
  onCancelEditing,
}: ListLayoutProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent, instanceId: string) => {
    setDraggedId(instanceId);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', instanceId);
  };

  const handleDragOver = (e: React.DragEvent, instanceId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== instanceId) {
      setDragOverId(instanceId);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedId && targetId && draggedId !== targetId) {
      onReorder(draggedId, targetId);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    setIsDragging(false);
  };

  const handleClick = (instanceId: string) => {
    if (!isDragging) {
      onSelect(instanceId);
    }
  };

  return (
    <div className="divide-y divide-surface-600">
      {instances.map((instance) => (
        <div
          key={instance.id}
          draggable={editingId !== instance.id}
          onDragStart={(e) => handleDragStart(e, instance.id)}
          onDragOver={(e) => handleDragOver(e, instance.id)}
          onDrop={(e) => handleDrop(e, instance.id)}
          onDragEnd={handleDragEnd}
          onDragLeave={() => setDragOverId(null)}
          onClick={() => handleClick(instance.id)}
          onDoubleClick={() => onExpand(instance.id)}
          className={`group flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing
            transition-all hover:bg-surface-700 relative
            ${draggedId === instance.id ? 'opacity-50 scale-[0.99]' : ''}
            ${dragOverId === instance.id ? 'bg-frost-4/20 ring-1 ring-frost-4 ring-inset' : ''}
            ${activeId === instance.id && dragOverId !== instance.id ? 'bg-surface-700' : ''}`}
        >
          {/* Drop indicator line */}
          {dragOverId === instance.id && (
            <div className="absolute -top-px left-0 right-0 h-0.5 bg-frost-4" />
          )}

          {/* Drag handle */}
          <span
            className="text-theme-dim opacity-50 group-hover:opacity-100 cursor-grab select-none text-xs"
            title="Drag to reorder"
          >
            ⋮⋮
          </span>

          {/* Pin button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(instance.id);
            }}
            className={`p-0.5 rounded transition-all
              ${instance.isPinned ? 'text-accent hover:text-accent-bright' : 'text-theme-dim hover:text-theme-primary'}`}
            title={instance.isPinned ? 'Unpin' : 'Pin'}
            aria-label={instance.isPinned ? `Unpin ${instance.name}` : `Pin ${instance.name}`}
            aria-pressed={instance.isPinned}
          >
            {Icons.star(instance.isPinned)}
          </button>

          <StatusDot status={instance.status} size="md" />

          {/* Name and path */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <EditableName
                name={instance.name}
                isEditing={editingId === instance.id}
                editingValue={editingName}
                onStartEdit={() => onStartEditing(instance.id, instance.name)}
                onValueChange={onEditingNameChange}
                onConfirm={() => onConfirmRename(instance.id)}
                onCancel={onCancelEditing}
                className="text-xs"
              />
            </div>
            <div className="text-[10px] text-theme-dim font-mono truncate">{instance.workingDir}</div>
          </div>

          <StatusBadge status={instance.status} />

          {/* Actions */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand(instance.id);
            }}
            className="p-0.5 rounded transition-all text-theme-dim hover:text-frost-2 hover:bg-frost-4/20 opacity-0 group-hover:opacity-100"
            title="Expand"
            aria-label={`Expand ${instance.name}`}
          >
            <Icons.expand />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose(instance);
            }}
            className="p-0.5 rounded transition-all text-theme-dim hover:text-state-error hover:bg-state-error/10 opacity-0 group-hover:opacity-100"
            title="Close"
            aria-label={`Close ${instance.name}`}
          >
            <Icons.close />
          </button>
        </div>
      ))}
    </div>
  );
});
