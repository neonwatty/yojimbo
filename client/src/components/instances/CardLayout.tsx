import { useState, memo } from 'react';
import type { Instance } from '@cc-orchestrator/shared';
import { StatusDot, StatusBadge } from '../common/Status';
import { EditableName } from '../common/EditableName';
import { Icons } from '../common/Icons';
import { formatRelativeTime } from '../../utils/strings';

interface CardLayoutProps {
  instances: Instance[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClose: (instance: Instance) => void;
  onExpand: (id: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onNewInstance: () => void;
  editingId: string | null;
  editingName: string;
  onStartEditing: (id: string, name: string) => void;
  onEditingNameChange: (name: string) => void;
  onConfirmRename: (id: string) => void;
  onCancelEditing: () => void;
}

export const CardLayout = memo(function CardLayout({
  instances,
  activeId,
  onSelect,
  onTogglePin,
  onClose,
  onExpand,
  onReorder,
  onNewInstance,
  editingId,
  editingName,
  onStartEditing,
  onEditingNameChange,
  onConfirmRename,
  onCancelEditing,
}: CardLayoutProps) {
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
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-3">
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
          className={`group relative
            bg-surface-700 rounded p-3 cursor-grab active:cursor-grabbing transition-all hover:bg-surface-600
            ${draggedId === instance.id ? 'opacity-50 scale-95' : ''}
            ${dragOverId === instance.id ? 'ring-1 ring-frost-4 scale-[1.01]' : ''}
            ${activeId === instance.id && dragOverId !== instance.id ? 'ring-1 ring-frost-4' : ''}`}
        >
          {/* Drag handle indicator */}
          <div
            className="absolute top-2 left-2 text-theme-dim opacity-50 group-hover:opacity-100 text-xs select-none"
            title="Drag to reorder"
          >

          </div>

          {/* Action buttons - slightly visible, full on hover */}
          <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-30 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand(instance.id);
              }}
              className="p-0.5 rounded transition-all text-theme-dim hover:text-frost-2 hover:bg-frost-4/20"
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
              className="p-0.5 rounded transition-all text-theme-dim hover:text-state-error hover:bg-state-error/10"
              title="Close"
              aria-label={`Close ${instance.name}`}
            >
              <Icons.close />
            </button>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-2 pr-10">
            <div className="flex items-center gap-1.5">
              <StatusDot status={instance.status} size="md" />
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
          </div>

          <StatusBadge status={instance.status} />
          <div className="mt-2 text-[10px] text-theme-dim font-mono truncate">{instance.workingDir}</div>
          <div className="mt-1 text-[10px] text-theme-dim">
            Created {formatRelativeTime(instance.createdAt)}
            {instance.updatedAt !== instance.createdAt && (
              <span className="text-surface-500"> · Active {formatRelativeTime(instance.updatedAt)}</span>
            )}
          </div>

          {/* Terminal preview */}
          <div className="mt-2 bg-surface-900 rounded p-2 h-16 overflow-hidden">
            <div className="terminal-text text-theme-dim text-[10px] font-mono">
              <div className="truncate">Terminal output...</div>
            </div>
          </div>
        </div>
      ))}

      {/* New Instance Card */}
      <div
        onClick={onNewInstance}
        className="bg-surface-800 rounded p-3 border border-dashed border-surface-600 flex items-center justify-center transition-colors min-h-[160px] cursor-pointer hover:border-surface-500"
      >
        <div className="text-center text-theme-dim">
          <div className="w-6 h-6 mx-auto mb-1 flex items-center justify-center">
            <Icons.plus />
          </div>
          <span className="text-xs">New Session</span>
        </div>
      </div>
    </div>
  );
});
