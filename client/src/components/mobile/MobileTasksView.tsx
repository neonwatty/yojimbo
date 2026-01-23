import { useState, useEffect, useCallback, useRef } from 'react';
import { todosApi } from '../../api/client';
import { useTodosStore } from '../../store/todosStore';
import { useInstancesStore } from '../../store/instancesStore';
import { Icons } from '../common/Icons';
import { toast } from '../../store/toastStore';
import type { GlobalTodo, Instance } from '@cc-orchestrator/shared';

interface MobileTasksViewProps {
  onTopGesture: () => void;
  onBottomGesture: () => void;
  onOpenNewInstance?: (options?: { todoText?: string }) => void;
}

export function MobileTasksView({ onTopGesture, onBottomGesture, onOpenNewInstance }: MobileTasksViewProps) {
  const { todos, setTodos, isLoading, setIsLoading } = useTodosStore();
  const { instances } = useInstancesStore();
  const [newTodoText, setNewTodoText] = useState('');
  const [swipingTodoId, setSwipingTodoId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [dispatchTodo, setDispatchTodo] = useState<GlobalTodo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const touchRef = useRef({ startY: 0, zone: null as string | null });

  // Navigation gesture handling for edge swipes
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = touch.clientY - rect.top;
    const height = rect.height;

    let zone: string | null = null;
    if (relativeY < 80) zone = 'top';
    else if (relativeY > height - 80) zone = 'bottom';

    touchRef.current = { startY: touch.clientY, zone };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const { startY, zone } = touchRef.current;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaY) > 50) {
      if (zone === 'top' && deltaY > 0 && onTopGesture) {
        onTopGesture();
      } else if (zone === 'bottom' && deltaY < 0 && onBottomGesture) {
        onBottomGesture();
      }
    }
  }, [onTopGesture, onBottomGesture]);

  const fetchTodos = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await todosApi.list();
      if (response.data) {
        setTodos(response.data);
      }
    } catch {
      // Error toast shown by API layer
    } finally {
      setIsLoading(false);
    }
  }, [setTodos, setIsLoading]);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleCreateTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    try {
      await todosApi.create({ text: newTodoText.trim() });
      setNewTodoText('');
      inputRef.current?.blur();
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleToggleDone = async (todo: GlobalTodo) => {
    try {
      if (todo.status === 'done') {
        await todosApi.update(todo.id, { status: 'captured' });
      } else {
        await todosApi.markDone(todo.id);
      }
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await todosApi.delete(todoId);
    } catch {
      // Error toast shown by API layer
    }
  };

  const handleDispatch = async (todo: GlobalTodo, instanceId: string | 'copy' | 'new') => {
    setDispatchTodo(null);

    if (instanceId === 'copy') {
      try {
        await navigator.clipboard.writeText(todo.text);
        toast.success('Copied to clipboard');
      } catch {
        toast.error('Failed to copy');
      }
      return;
    }

    if (instanceId === 'new') {
      // Copy todo text to clipboard so it's ready to paste in the new instance
      try {
        await navigator.clipboard.writeText(todo.text);
        toast.success('Todo copied to clipboard');
      } catch {
        // Continue even if clipboard fails
      }
      onOpenNewInstance?.({ todoText: todo.text });
      return;
    }

    try {
      await todosApi.dispatch(todo.id, { instanceId, copyToClipboard: false });
      toast.success('Dispatched');
    } catch {
      // Error toast shown by API layer
    }
  };

  const activeInstances = instances.filter((i: Instance) => !i.closedAt);
  const activeTodos = todos.filter((t: GlobalTodo) => t.status !== 'archived');

  const getStatusIcon = (todo: GlobalTodo) => {
    if (todo.status === 'done') {
      return (
        <div className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center">
          <Icons.check className="w-4 h-4 text-white" />
        </div>
      );
    }
    if (todo.status === 'in_progress') {
      return (
        <div className="w-6 h-6 rounded-lg border-2 border-yellow-500 flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-yellow-500 rounded-full" />
        </div>
      );
    }
    return <div className="w-6 h-6 rounded-lg border-2 border-surface-500" />;
  };

  const linkedInstance = (todo: GlobalTodo): Instance | undefined => {
    return todo.dispatchedInstanceId
      ? instances.find((i: Instance) => i.id === todo.dispatchedInstanceId)
      : undefined;
  };

  return (
    <div
      className="flex-1 flex flex-col bg-surface-800 overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Visual hint indicator */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>

      <div className="flex-1 px-4 pb-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-theme-primary">Todos</h1>
            {activeTodos.filter((t: GlobalTodo) => t.status === 'captured' || t.status === 'in_progress').length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-accent/20 text-accent rounded-full">
                {activeTodos.filter((t: GlobalTodo) => t.status === 'captured' || t.status === 'in_progress').length} pending
              </span>
            )}
          </div>
        </div>

        {/* Quick Add Input */}
        <form onSubmit={handleCreateTodo} className="mb-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              placeholder="Add a todo..."
              className="flex-1 px-4 py-3 bg-surface-800 border border-surface-600 rounded-lg text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-accent text-sm"
            />
            <button
              type="submit"
              disabled={!newTodoText.trim()}
              className="px-4 py-3 bg-accent text-surface-900 rounded-lg font-medium text-sm active:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </form>

        {/* Loading state */}
        {isLoading && todos.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-800 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-surface-600 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Todos List */}
        {(!isLoading || todos.length > 0) && (
          <div
            className="flex-1 overflow-auto mobile-scroll space-y-2"
            data-testid="todo-list"
            onClick={(e) => {
              // Close any revealed swipe actions when tapping outside todo actions
              if (swipingTodoId && !(e.target as HTMLElement).closest('button')) {
                setSwipingTodoId(null);
                setSwipeOffset(0);
              }
            }}
          >
            {activeTodos.map((todo: GlobalTodo) => (
              <SwipeableTodoItem
                key={todo.id}
                todo={todo}
                linkedInstance={linkedInstance(todo)}
                isSwiping={swipingTodoId === todo.id}
                swipeOffset={swipingTodoId === todo.id ? swipeOffset : 0}
                onSwipeStart={() => setSwipingTodoId(todo.id)}
                onSwipeMove={setSwipeOffset}
                onSwipeEnd={() => {
                  setSwipingTodoId(null);
                  setSwipeOffset(0);
                }}
                onToggleDone={() => {
                  handleToggleDone(todo);
                  setSwipingTodoId(null);
                  setSwipeOffset(0);
                }}
                onDispatch={() => {
                  setDispatchTodo(todo);
                  setSwipingTodoId(null);
                  setSwipeOffset(0);
                }}
                onDelete={() => {
                  handleDeleteTodo(todo.id);
                  setSwipingTodoId(null);
                  setSwipeOffset(0);
                }}
                getStatusIcon={() => getStatusIcon(todo)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && activeTodos.length === 0 && (
          <div className="text-center py-12 text-theme-muted">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm">No todos yet</p>
            <p className="text-xs mt-2 opacity-70">
              Add todos above to get started
            </p>
          </div>
        )}

        {/* Action hints */}
        {activeTodos.length > 0 && (
          <div className="mt-3 flex justify-center gap-6 text-[10px] text-theme-dim">
            <span>Swipe or tap ⋮ for actions</span>
          </div>
        )}
      </div>

      {/* Bottom gesture hint */}
      <div className="flex justify-center pb-2">
        <div className="w-10 h-1 bg-surface-500/50 rounded-full" />
      </div>

      {/* Dispatch Bottom Sheet */}
      {dispatchTodo && (
        <TodoDispatchSheet
          todo={dispatchTodo}
          instances={activeInstances}
          onDispatch={(instanceId) => handleDispatch(dispatchTodo, instanceId)}
          onClose={() => setDispatchTodo(null)}
        />
      )}
    </div>
  );
}

// Swipeable todo item with reveal actions
interface SwipeableTodoItemProps {
  todo: GlobalTodo;
  linkedInstance?: Instance;
  isSwiping: boolean;
  swipeOffset: number;
  onSwipeStart: () => void;
  onSwipeMove: (offset: number) => void;
  onSwipeEnd: () => void;
  onToggleDone: () => void;
  onDispatch: () => void;
  onDelete: () => void;
  getStatusIcon: () => React.ReactNode;
}

function SwipeableTodoItem({
  todo,
  linkedInstance,
  swipeOffset,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  onToggleDone,
  onDispatch,
  onDelete,
  getStatusIcon,
}: SwipeableTodoItemProps) {
  const touchRef = useRef({ startX: 0, startY: 0, isHorizontal: false });
  const [showMenu, setShowMenu] = useState(false);
  const ACTION_THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, isHorizontal: false };
    onSwipeStart();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchRef.current.startX;
    const deltaY = touch.clientY - touchRef.current.startY;

    // Determine if horizontal swipe on first significant movement
    if (!touchRef.current.isHorizontal && Math.abs(deltaX) > 10) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        touchRef.current.isHorizontal = true;
      }
    }

    if (touchRef.current.isHorizontal) {
      e.preventDefault();
      // Only allow left swipe (negative offset), max to reveal all 3 buttons
      const clampedOffset = Math.max(-200, Math.min(0, deltaX));
      onSwipeMove(clampedOffset);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset < -ACTION_THRESHOLD) {
      // Keep revealed - show all 3 buttons (3 x 64px = 192px)
      onSwipeMove(-192);
    } else {
      // Close and reset
      onSwipeMove(0);
      setTimeout(onSwipeEnd, 300);
    }
  };

  const isRevealed = swipeOffset < -50;

  return (
    <div className="relative overflow-hidden rounded-lg" data-testid="swipeable-todo">
      {/* Action buttons revealed on swipe */}
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
        <button
          onClick={onDispatch}
          className="w-16 bg-frost-3 flex items-center justify-center active:bg-frost-2"
          data-testid="dispatch-button"
        >
          <Icons.send className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={onToggleDone}
          className="w-16 bg-green-500 flex items-center justify-center active:bg-green-600"
          data-testid="done-button"
        >
          <Icons.check className="w-5 h-5 text-white" />
        </button>
        <button
          onClick={onDelete}
          className="w-16 bg-red-500 flex items-center justify-center active:bg-red-600"
          data-testid="delete-button"
        >
          <Icons.trash className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main todo content */}
      <div
        className="relative bg-surface-800 p-4 transition-transform"
        style={{ transform: `translateX(${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        data-testid="todo-content"
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button onClick={onToggleDone} className="shrink-0 mt-0.5" data-testid={`todo-checkbox-${todo.id}`}>
            {getStatusIcon()}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm break-words ${
                todo.status === 'done' ? 'text-theme-muted line-through' : 'text-theme-primary'
              }`}
            >
              {todo.text}
            </p>
            {linkedInstance && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/20 rounded text-xs text-yellow-400">
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                {linkedInstance.name}
              </div>
            )}
          </div>

          {/* Action menu button (alternative to swipe) */}
          {!isRevealed && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="shrink-0 p-1 -mr-1 text-theme-dim hover:text-theme-muted active:text-theme-primary transition-colors"
              data-testid={`todo-menu-${todo.id}`}
              aria-label="Todo actions"
            >
              <Icons.moreVertical className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown action menu */}
        {showMenu && (
          <div
            className="absolute right-2 top-full mt-1 z-10 bg-surface-700 rounded-lg shadow-lg border border-surface-600 overflow-hidden"
            data-testid={`todo-menu-dropdown-${todo.id}`}
          >
            <button
              onClick={() => {
                setShowMenu(false);
                onDispatch();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-theme-primary hover:bg-surface-600 active:bg-surface-500 transition-colors"
            >
              <Icons.send className="w-4 h-4 text-frost-3" />
              Dispatch
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onToggleDone();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-theme-primary hover:bg-surface-600 active:bg-surface-500 transition-colors"
            >
              <Icons.check className="w-4 h-4 text-green-500" />
              {todo.status === 'done' ? 'Mark pending' : 'Mark done'}
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onDelete();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-surface-600 active:bg-surface-500 transition-colors"
            >
              <Icons.trash className="w-4 h-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Backdrop to close menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}

// Dispatch bottom sheet
interface TodoDispatchSheetProps {
  todo: GlobalTodo;
  instances: Instance[];
  onDispatch: (instanceId: string | 'copy' | 'new') => void;
  onClose: () => void;
}

function TodoDispatchSheet({ todo, instances, onDispatch, onClose }: TodoDispatchSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end"
      onClick={handleBackdropClick}
    >
      <div
        ref={sheetRef}
        className="w-full bg-surface-700 rounded-t-2xl animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-surface-500 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-4 border-b border-surface-600">
          <h3 className="text-lg font-semibold text-theme-primary">Dispatch Todo</h3>
          <p className="text-sm text-theme-muted line-clamp-2 mt-1">{todo.text}</p>
        </div>

        {/* Options */}
        <div className="py-2">
          {/* Copy to clipboard */}
          <button
            onClick={() => onDispatch('copy')}
            className="w-full flex items-center gap-4 px-4 py-4 active:bg-surface-600 transition-colors"
          >
            <div className="w-10 h-10 bg-surface-600 rounded-lg flex items-center justify-center">
              <Icons.clipboard className="w-5 h-5 text-theme-muted" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-theme-primary">Copy to clipboard</p>
              <p className="text-xs text-theme-muted">Paste manually into an instance</p>
            </div>
          </button>

          {/* Divider */}
          {instances.length > 0 && (
            <div className="px-4 py-2">
              <p className="text-xs text-theme-dim font-medium uppercase tracking-wide">Running Instances</p>
            </div>
          )}

          {/* Instance list */}
          {instances.map((instance) => (
            <button
              key={instance.id}
              onClick={() => onDispatch(instance.id)}
              className="w-full flex items-center gap-4 px-4 py-4 active:bg-surface-600 transition-colors"
            >
              <div className="w-10 h-10 bg-surface-600 rounded-lg flex items-center justify-center">
                <Icons.terminal className="w-5 h-5 text-theme-muted" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-theme-primary">{instance.name}</p>
                <p className="text-xs text-theme-muted truncate">{instance.workingDir}</p>
              </div>
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  instance.status === 'working'
                    ? 'bg-yellow-500'
                    : instance.status === 'error'
                    ? 'bg-red-500'
                    : 'bg-green-500'
                }`}
              />
            </button>
          ))}

          {/* Create new instance */}
          <button
            onClick={() => onDispatch('new')}
            className="w-full flex items-center gap-4 px-4 py-4 active:bg-surface-600 transition-colors"
          >
            <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center">
              <Icons.plus className="w-5 h-5 text-accent" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-accent">Create new instance</p>
              <p className="text-xs text-theme-muted">Start a new Claude Code session</p>
            </div>
          </button>
        </div>

        {/* Cancel button */}
        <div className="px-4 pt-2 pb-4">
          <button
            onClick={onClose}
            className="w-full py-3 bg-surface-600 text-theme-primary rounded-lg font-medium active:bg-surface-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileTasksView;
