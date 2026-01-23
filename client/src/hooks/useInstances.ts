import { useEffect, useCallback } from 'react';
import { useInstancesStore } from '../store/instancesStore';
import { useFeedStore } from '../store/feedStore';
import { useTodosStore } from '../store/todosStore';
import { useUIStore } from '../store/uiStore';
import { instancesApi, feedApi, todosApi, keychainApi } from '../api/client';
import { useWebSocket } from './useWebSocket';
import { getWsUrl } from '../config';
import type { Instance, ActivityEvent, GlobalTodo } from '@cc-orchestrator/shared';

export function useInstances() {
  const { instances, setInstances, setLoading, addInstance, updateInstance, removeInstance, setCurrentCwd } = useInstancesStore();
  const { addEvent, setStats } = useFeedStore();
  const { addTodo, updateTodo: updateTodoInStore, removeTodo, setStats: setTodoStats } = useTodosStore();
  const { showLocalKeychainUnlockPrompt } = useUIStore();

  const { subscribe, isConnected } = useWebSocket(getWsUrl(), {
    onOpen: () => {
      console.log('WebSocket connected for instance updates');
    },
  });

  // Fetch instances on mount
  const fetchInstances = useCallback(async () => {
    try {
      const response = await instancesApi.list();
      if (response.data) {
        setInstances(response.data);
      }
    } catch {
      // Error toast shown by API layer
    } finally {
      setLoading(false);
    }
  }, [setInstances, setLoading]);

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribeCreated = subscribe('instance:created', (data: unknown) => {
      const { instance } = data as { instance: Instance };
      addInstance(instance);
    });

    const unsubscribeUpdated = subscribe('instance:updated', (data: unknown) => {
      const { instance } = data as { instance: Instance };
      updateInstance(instance.id, instance);
    });

    const unsubscribeClosed = subscribe('instance:closed', (data: unknown) => {
      const { instanceId } = data as { instanceId: string };
      removeInstance(instanceId);
    });

    const unsubscribeStatus = subscribe('status:changed', (data: unknown) => {
      const { instanceId, status } = data as { instanceId: string; status: Instance['status'] };
      updateInstance(instanceId, { status });
    });

    const unsubscribeCwd = subscribe('cwd:changed', (data: unknown) => {
      const { instanceId, cwd } = data as { instanceId: string; cwd: string };
      setCurrentCwd(instanceId, cwd);
    });

    // Feed events
    const unsubscribeFeedNew = subscribe('feed:new', (data: unknown) => {
      const { event } = data as { event: ActivityEvent };
      addEvent(event);
    });

    const unsubscribeFeedUpdated = subscribe('feed:updated', async () => {
      // Refresh feed stats when something changes
      try {
        const response = await feedApi.getStats();
        if (response.data) {
          setStats(response.data);
        }
      } catch {
        // Ignore errors
      }
    });

    // Todo events
    const unsubscribeTodoCreated = subscribe('todo:created', (data: unknown) => {
      const { todo } = data as { todo: GlobalTodo };
      addTodo(todo);
    });

    const unsubscribeTodoUpdated = subscribe('todo:updated', (data: unknown) => {
      const { todo } = data as { todo: GlobalTodo | undefined };
      if (todo) {
        updateTodoInStore(todo.id, todo);
      }
      // Refresh stats when todos are updated
      todosApi.getStats().then((response) => {
        if (response.data) {
          setTodoStats(response.data);
        }
      }).catch(() => {});
    });

    const unsubscribeTodoDeleted = subscribe('todo:deleted', (data: unknown) => {
      const { todoId } = data as { todoId: string };
      removeTodo(todoId);
      // Refresh stats when todos are deleted
      todosApi.getStats().then((response) => {
        if (response.data) {
          setTodoStats(response.data);
        }
      }).catch(() => {});
    });

    // Local keychain unlock failure
    const unsubscribeKeychainFailed = subscribe('keychain:unlock-failed', (data: unknown) => {
      const { keychainError } = data as { keychainError?: string };
      console.log('🔒 Local keychain unlock failed:', keychainError);
      showLocalKeychainUnlockPrompt(keychainError);
    });

    // Re-fetch instances after WebSocket connects to catch any status updates
    // that occurred before we subscribed (fixes race condition)
    fetchInstances();

    // Also fetch initial feed stats
    feedApi.getStats().then((response) => {
      if (response.data) {
        setStats(response.data);
      }
    }).catch(() => {});

    // Fetch initial todo stats
    todosApi.getStats().then((response) => {
      if (response.data) {
        setTodoStats(response.data);
      }
    }).catch(() => {});

    // Check local keychain status on connect - prompt if locked
    keychainApi.status().then((response) => {
      if (response.data?.locked) {
        console.log('🔒 Local keychain is locked, prompting user');
        showLocalKeychainUnlockPrompt('Keychain is locked. Enter your macOS password to unlock.');
      }
    }).catch(() => {
      // Ignore errors - likely not on macOS
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeClosed();
      unsubscribeStatus();
      unsubscribeCwd();
      unsubscribeFeedNew();
      unsubscribeFeedUpdated();
      unsubscribeTodoCreated();
      unsubscribeTodoUpdated();
      unsubscribeTodoDeleted();
      unsubscribeKeychainFailed();
    };
  }, [isConnected, subscribe, addInstance, updateInstance, removeInstance, setCurrentCwd, fetchInstances, addEvent, setStats, addTodo, updateTodoInStore, removeTodo, setTodoStats, showLocalKeychainUnlockPrompt]);

  // Fetch instances on mount
  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  return {
    instances,
    refetch: fetchInstances,
    isConnected,
  };
}
