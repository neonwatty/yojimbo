import { useState, memo } from 'react';
import type { Instance } from '@cc-orchestrator/shared';
import { StatusDot, StatusBadge } from '../common/Status';
import { EditableName } from '../common/EditableName';
import { Icons } from '../common/Icons';
import { Spinner } from '../common/Spinner';

interface CardLayoutProps {
  instances: Instance[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  onClose: (instance: Instance) => void;
  onExpand: (id: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onNewInstance: () => void;
  isCreating?: boolean;
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
  isCreating = false,
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
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-4">
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
          className={`group relative hover-lift
            bg-surface-700 rounded-xl p-4 cursor-grab active:cursor-grabbing transition-all hover:bg-surface-600
            ${draggedId === instance.id ? 'opacity-50 scale-95' : ''}
            ${dragOverId === instance.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface-800 scale-[1.02]' : ''}
            ${activeId === instance.id && dragOverId !== instance.id ? 'ring-2 ring-accent active-glow' : ''}`}
        >
          {/* Drag handle indicator */}
          <div
            className="absolute top-2 left-2 text-theme-dim opacity-50 group-hover:opacity-100 text-xs select-none"
            title="Drag to reorder"
          >

          </div>

          {/* Action buttons */}
          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand(instance.id);
              }}
              className="p-1 rounded transition-all text-gray-500 hover:text-accent hover:bg-accent/10"
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
              className="p-1 rounded transition-all text-gray-500 hover:text-red-400 hover:bg-red-400/10"
              title="Close"
              aria-label={`Close ${instance.name}`}
            >
              <Icons.close />
            </button>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-3 pr-12">
            <div className="flex items-center gap-2">
              <StatusDot status={instance.status} size="lg" />
              <EditableName
                name={instance.name}
                isEditing={editingId === instance.id}
                editingValue={editingName}
                onStartEdit={() => onStartEditing(instance.id, instance.name)}
                onValueChange={onEditingNameChange}
                onConfirm={() => onConfirmRename(instance.id)}
                onCancel={onCancelEditing}
              />
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(instance.id);
              }}
              className={`p-1 rounded transition-all transform hover:scale-110 active:scale-95
                ${instance.isPinned ? 'text-accent hover:text-accent-bright' : 'text-gray-500 hover:text-gray-300'}`}
              title={instance.isPinned ? 'Unpin' : 'Pin'}
              aria-label={instance.isPinned ? `Unpin ${instance.name}` : `Pin ${instance.name}`}
              aria-pressed={instance.isPinned}
            >
              {Icons.star(instance.isPinned)}
            </button>
          </div>

          <StatusBadge status={instance.status} />
          <div className="mt-3 text-xs text-gray-500 font-mono truncate">{instance.workingDir}</div>

          {/* Terminal preview */}
          <div className="mt-3 bg-surface-900 rounded-lg p-3 h-20 overflow-hidden">
            <div className="terminal-text text-gray-400 text-xs font-mono">
              <div className="truncate text-theme-muted">Terminal output...</div>
            </div>
          </div>
        </div>
      ))}

      {/* New Instance Card */}
      <div
        onClick={isCreating ? undefined : onNewInstance}
        className={`bg-surface-800 rounded-xl p-4 border-2 border-dashed border-surface-600 flex items-center justify-center transition-colors min-h-[200px] ${
          isCreating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-surface-500'
        }`}
      >
        <div className="text-center text-gray-500">
          <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
            {isCreating ? <Spinner size="md" /> : <Icons.plus />}
          </div>
          <span className="text-sm">{isCreating ? 'Creating...' : 'New Instance'}</span>
        </div>
      </div>
    </div>
  );
});
