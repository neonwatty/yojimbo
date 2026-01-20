import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../common/Icons';
import { useTasksStore } from '../../store/tasksStore';
import { useInstancesStore } from '../../store/instancesStore';
import { tasksApi } from '../../api/client';
import { toast } from '../../store/toastStore';
import { SmartTasksModal } from './smart';
import type { GlobalTask, Instance } from '@cc-orchestrator/shared';

interface GlobalTasksPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewInstance?: (options?: { taskText?: string }) => void;
}

export function GlobalTasksPanel({ isOpen, onClose, onOpenNewInstance }: GlobalTasksPanelProps) {
  const { tasks, setTasks, setIsLoading, isLoading } = useTasksStore();
  const { instances } = useInstancesStore();
  const [newTaskText, setNewTaskText] = useState('');
  const [dispatchingTaskId, setDispatchingTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [animatingTaskIds, setAnimatingTaskIds] = useState<Set<string>>(new Set());
  const [isSmartTasksOpen, setIsSmartTasksOpen] = useState(false);
  const prevTaskIdsRef = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Track new tasks for enter animations
  useEffect(() => {
    const currentIds = new Set(tasks.map(t => t.id));
    const prevIds = prevTaskIdsRef.current;

    // Find newly added tasks
    const newTaskIds = new Set<string>();
    currentIds.forEach(id => {
      if (!prevIds.has(id)) {
        newTaskIds.add(id);
      }
    });

    if (newTaskIds.size > 0) {
      setAnimatingTaskIds(prev => new Set([...prev, ...newTaskIds]));
      // Remove animation class after animation completes
      setTimeout(() => {
        setAnimatingTaskIds(prev => {
          const next = new Set(prev);
          newTaskIds.forEach(id => next.delete(id));
          return next;
        });
      }, 300);
    }

    prevTaskIdsRef.current = currentIds;
  }, [tasks]);

  // Fetch tasks when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchTasks();
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !dispatchingTaskId) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, dispatchingTaskId]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await tasksApi.list();
      if (response.data) {
        setTasks(response.data);
      }
    } catch {
      // Error toast shown by API layer
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    try {
      await tasksApi.create({ text: newTaskText.trim() });
      setNewTaskText('');
      inputRef.current?.focus();
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleToggleDone = async (task: GlobalTask) => {
    try {
      if (task.status === 'done') {
        // Unmark as done
        await tasksApi.update(task.id, { status: 'captured' });
      } else {
        // Mark as done
        await tasksApi.markDone(task.id);
      }
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await tasksApi.delete(taskId);
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleUpdateTask = async (taskId: string, newText: string) => {
    try {
      await tasksApi.update(taskId, { text: newText });
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleReorder = async (fromId: string, toId: string) => {
    if (fromId === toId) return;

    const filteredTasks = tasks.filter((t) => t.status !== 'archived');
    const fromIndex = filteredTasks.findIndex((t) => t.id === fromId);
    const toIndex = filteredTasks.findIndex((t) => t.id === toId);

    if (fromIndex === -1 || toIndex === -1) return;

    // Create new order
    const newOrder = [...filteredTasks];
    const [movedTask] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedTask);

    // Optimistically update UI
    setTasks(newOrder);

    try {
      await tasksApi.reorder({ taskIds: newOrder.map((t) => t.id) });
    } catch {
      // Revert on error - refetch to get correct order
      fetchTasks();
    }
  };

  const handleDispatch = async (task: GlobalTask, instanceId: string | 'copy' | 'new') => {
    setDispatchingTaskId(null);

    if (instanceId === 'copy') {
      try {
        await navigator.clipboard.writeText(task.text);
        toast.success('Copied to clipboard');
      } catch {
        toast.error('Failed to copy to clipboard');
      }
      return;
    }

    if (instanceId === 'new') {
      // Copy task text to clipboard so it's ready to paste in the new instance
      try {
        await navigator.clipboard.writeText(task.text);
        toast.success('Task copied to clipboard');
      } catch {
        // Continue even if clipboard fails
      }
      onOpenNewInstance?.({ taskText: task.text });
      return;
    }

    try {
      await tasksApi.dispatch(task.id, { instanceId, copyToClipboard: false });
      toast.success('Task dispatched to instance');
    } catch {
      // Error toast shown by API layer
    }
  };

  // Filter out closed instances
  const activeInstances = instances.filter((i) => !i.closedAt);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-surface-700 rounded-xl shadow-2xl max-w-xl w-full mx-4 animate-in max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-theme-primary">Global Tasks</h2>
            <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
              {tasks.filter((t) => t.status !== 'archived').length} tasks
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-theme-muted hover:text-theme-primary hover:bg-surface-600 transition-colors"
          >
            <Icons.close />
          </button>
        </div>

        {/* Task Input */}
        <form onSubmit={handleCreateTask} className="px-6 py-4 border-b border-surface-600 shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1 px-3 py-2 bg-surface-800 border border-surface-600 rounded-lg text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-accent text-sm font-mono"
            />
            <button
              type="submit"
              disabled={!newTaskText.trim()}
              className="px-4 py-2 bg-accent text-surface-900 rounded-lg font-medium text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsSmartTasksOpen(true)}
              className="px-3 py-2 bg-surface-600 text-theme-primary rounded-lg text-sm hover:bg-surface-500 transition-colors flex items-center gap-2"
              title="Smart task input with AI parsing"
            >
              <Icons.sparkles />
              Smart
            </button>
          </div>
        </form>

        {/* Task List */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-theme-muted text-sm">No tasks yet. Add one above!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks
                .filter((t) => t.status !== 'archived')
                .map((task, index) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    instances={activeInstances}
                    isDispatchOpen={dispatchingTaskId === task.id}
                    isDragging={draggedTaskId === task.id}
                    isDragOver={dragOverTaskId === task.id && draggedTaskId !== task.id}
                    isAnimatingIn={animatingTaskIds.has(task.id)}
                    animationDelay={index * 30}
                    onToggleDone={() => handleToggleDone(task)}
                    onDelete={() => handleDeleteTask(task.id)}
                    onEdit={(newText) => handleUpdateTask(task.id, newText)}
                    onOpenDispatch={() => setDispatchingTaskId(task.id)}
                    onCloseDispatch={() => setDispatchingTaskId(null)}
                    onDispatch={(instanceId) => handleDispatch(task, instanceId)}
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onDragEnd={() => {
                      if (draggedTaskId && dragOverTaskId && draggedTaskId !== dragOverTaskId) {
                        handleReorder(draggedTaskId, dragOverTaskId);
                      }
                      setDraggedTaskId(null);
                      setDragOverTaskId(null);
                    }}
                    onDragOver={() => setDragOverTaskId(task.id)}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-surface-600 text-center shrink-0">
          <span className="text-xs text-theme-muted">
            Press{' '}
            <kbd className="px-1.5 py-0.5 bg-surface-800 border border-surface-500 rounded text-xs font-mono">
              Esc
            </kbd>{' '}
            to close
          </span>
        </div>
      </div>

      {/* Smart Tasks Modal */}
      <SmartTasksModal
        isOpen={isSmartTasksOpen}
        onClose={() => {
          setIsSmartTasksOpen(false);
          // Refetch tasks in case new ones were created
          fetchTasks();
        }}
      />
    </div>
  );
}

interface TaskItemProps {
  task: GlobalTask;
  instances: Instance[];
  isDispatchOpen: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  isAnimatingIn: boolean;
  animationDelay: number;
  onToggleDone: () => void;
  onDelete: () => void;
  onEdit: (newText: string) => void;
  onOpenDispatch: () => void;
  onCloseDispatch: () => void;
  onDispatch: (instanceId: string | 'copy' | 'new') => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
}

function TaskItem({
  task,
  instances,
  isDispatchOpen,
  isDragging,
  isDragOver,
  isAnimatingIn,
  animationDelay,
  onToggleDone,
  onDelete,
  onEdit,
  onOpenDispatch,
  onCloseDispatch,
  onDispatch,
  onDragStart,
  onDragEnd,
  onDragOver,
}: TaskItemProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditText(task.text);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditText(task.text);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== task.text) {
      onEdit(trimmed);
    }
    setIsEditing(false);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation(); // Prevent modal from closing
      handleCancelEdit();
    }
  };

  // Calculate dropdown position when it opens
  useEffect(() => {
    if (isDispatchOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position dropdown below and to the left of the button
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.right - 224, // 224 = w-56 (14rem = 224px)
      });
    }
  }, [isDispatchOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isDispatchOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        onCloseDispatch();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDispatchOpen, onCloseDispatch]);

  const getStatusIcon = () => {
    if (task.status === 'done') {
      return (
        <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center">
          <Icons.check className="w-4 h-4 text-white" />
        </div>
      );
    }
    if (task.status === 'in_progress') {
      return (
        <div className="w-6 h-6 rounded-lg border-2 border-yellow-500 flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
        </div>
      );
    }
    return <div className="w-6 h-6 rounded-lg border-2 border-surface-500" />;
  };

  const linkedInstance = task.dispatchedInstanceId
    ? instances.find((i) => i.id === task.dispatchedInstanceId)
    : null;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver();
      }}
      className={`group flex items-start gap-3 p-4 bg-surface-800 rounded-lg transition-all cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 scale-[0.98]' : 'hover:bg-surface-600/50'
      } ${isDragOver ? 'ring-2 ring-accent ring-inset' : ''} ${
        isAnimatingIn ? 'animate-in fade-in slide-in-from-top-2 duration-200' : ''
      }`}
      style={isAnimatingIn ? { animationDelay: `${animationDelay}ms` } : undefined}
    >
      {/* Drag Handle */}
      <div className="shrink-0 flex items-center text-theme-muted/50 group-hover:text-theme-muted transition-colors">
        <Icons.grip className="w-4 h-4" />
      </div>

      {/* Checkbox */}
      <button
        onClick={onToggleDone}
        className="shrink-0 mt-0.5 hover:opacity-80 transition-opacity"
      >
        {getStatusIcon()}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={handleSaveEdit}
              className="flex-1 px-2 py-1 bg-surface-900 border border-accent rounded text-sm font-mono text-theme-primary focus:outline-none"
            />
          </div>
        ) : (
          <>
            <p
              onDoubleClick={handleStartEdit}
              className={`text-sm font-mono break-words cursor-text ${
                task.status === 'done' ? 'text-theme-muted line-through' : 'text-theme-primary'
              }`}
              title="Double-click to edit"
            >
              {task.text}
            </p>
            {linkedInstance && (
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 rounded text-xs text-yellow-400">
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                {linkedInstance.name}
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Edit Button */}
        <button
          onClick={handleStartEdit}
          className="p-1.5 rounded text-theme-muted hover:text-theme-primary hover:bg-surface-700 transition-colors"
          title="Edit task"
        >
          <Icons.edit className="w-4 h-4" />
        </button>

        {/* Dispatch Button */}
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={onOpenDispatch}
            className="p-1.5 rounded text-theme-muted hover:text-accent hover:bg-surface-700 transition-colors"
            title="Dispatch to instance"
          >
            <Icons.send className="w-4 h-4" />
          </button>

          {/* Dispatch Dropdown - rendered via portal to avoid overflow clipping */}
          {isDispatchOpen && createPortal(
            <div
              ref={dropdownRef}
              className="fixed w-56 bg-surface-700 border border-surface-600 rounded-lg shadow-xl z-[100] py-1"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            >
              <button
                onClick={() => onDispatch('copy')}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-theme-primary hover:bg-surface-600 transition-colors"
              >
                <Icons.clipboard className="w-4 h-4 text-theme-muted" />
                Copy to clipboard
              </button>

              {instances.length > 0 && (
                <>
                  <div className="h-px bg-surface-600 my-1" />
                  <div className="px-3 py-1.5 text-xs text-theme-muted">
                    Running Instances
                  </div>
                  {instances.map((instance) => (
                    <button
                      key={instance.id}
                      onClick={() => onDispatch(instance.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-theme-primary hover:bg-surface-600 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icons.terminal className="w-4 h-4 text-theme-muted shrink-0" />
                        <span className="truncate">{instance.name}</span>
                      </div>
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          instance.status === 'working'
                            ? 'bg-yellow-500'
                            : instance.status === 'error'
                            ? 'bg-red-500'
                            : 'bg-green-500'
                        }`}
                      />
                    </button>
                  ))}
                </>
              )}

              <div className="h-px bg-surface-600 my-1" />
              <button
                onClick={() => onDispatch('new')}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-accent hover:bg-surface-600 transition-colors"
              >
                <Icons.plus className="w-4 h-4" />
                Create new instance
              </button>
            </div>,
            document.body
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={onDelete}
          className="p-1.5 rounded text-theme-muted hover:text-red-400 hover:bg-surface-700 transition-colors"
          title="Delete task"
        >
          <Icons.trash className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
