import { useMemo, useState, useCallback } from 'react';
import { useInstancesStore } from '../store/instancesStore';
import type { Instance } from '@cc-orchestrator/shared';

interface UseQueueModeOptions {
  /**
   * If true, includes instances that were previously skipped this session
   */
  includeSkipped?: boolean;
}

interface UseQueueModeReturn {
  /** Idle instances available for review */
  idleInstances: Instance[];
  /** Currently displayed instance */
  currentInstance: Instance | undefined;
  /** Current index in the queue */
  currentIndex: number;
  /** Total number of idle instances */
  totalCount: number;
  /** Number of instances remaining (not yet reviewed) */
  remainingCount: number;
  /** Whether there are more instances to review */
  hasMore: boolean;
  /** Whether the queue is empty */
  isEmpty: boolean;
  /** Move to the next instance */
  next: () => void;
  /** Move to the previous instance */
  previous: () => void;
  /** Skip the current instance (won't show again this session) */
  skip: () => void;
  /** Reset skipped instances and start over */
  reset: () => void;
  /** Set of skipped instance IDs */
  skippedIds: Set<string>;
}

/**
 * Hook for managing queue mode navigation through idle instances.
 * Provides a card-stack style navigation experience.
 */
export function useQueueMode(options: UseQueueModeOptions = {}): UseQueueModeReturn {
  const { includeSkipped = false } = options;
  const instances = useInstancesStore((state) => state.instances);

  // Track which instances have been skipped this session
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  // Track current position in the queue
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter to only idle instances, optionally excluding skipped ones
  const idleInstances = useMemo(() => {
    return instances.filter((instance) => {
      // Only include idle instances
      if (instance.status !== 'idle') return false;
      // Optionally filter out skipped instances
      if (!includeSkipped && skippedIds.has(instance.id)) return false;
      return true;
    });
  }, [instances, skippedIds, includeSkipped]);

  const totalCount = idleInstances.length;
  const currentInstance = idleInstances[currentIndex];
  const hasMore = currentIndex < totalCount - 1;
  const isEmpty = totalCount === 0;
  const remainingCount = totalCount - currentIndex;

  const next = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, totalCount - 1));
  }, [totalCount]);

  const previous = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const skip = useCallback(() => {
    if (currentInstance) {
      setSkippedIds((prev) => new Set([...prev, currentInstance.id]));
      // Stay at same index since the array will shrink
      // But clamp to valid range
      setCurrentIndex((prev) => Math.min(prev, Math.max(0, totalCount - 2)));
    }
  }, [currentInstance, totalCount]);

  const reset = useCallback(() => {
    setSkippedIds(new Set());
    setCurrentIndex(0);
  }, []);

  return {
    idleInstances,
    currentInstance,
    currentIndex,
    totalCount,
    remainingCount,
    hasMore,
    isEmpty,
    next,
    previous,
    skip,
    reset,
    skippedIds,
  };
}
