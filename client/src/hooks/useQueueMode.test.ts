import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQueueMode } from './useQueueMode';
import { useInstancesStore } from '../store/instancesStore';
import type { Instance } from '@cc-orchestrator/shared';

// Helper to create mock instances
function createMockInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    id: `instance-${Math.random().toString(36).slice(2)}`,
    name: 'Test Instance',
    workingDir: '/test/path',
    status: 'idle',
    isPinned: false,
    displayOrder: 0,
    pid: null,
    machineType: 'local',
    machineId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    closedAt: null,
    ...overrides,
  };
}

describe('useQueueMode', () => {
  beforeEach(() => {
    // Reset instances store before each test
    useInstancesStore.setState({ instances: [] });
  });

  describe('filtering', () => {
    it('returns only idle instances', () => {
      const idleInstance = createMockInstance({ status: 'idle', name: 'Idle 1' });
      const workingInstance = createMockInstance({ status: 'working', name: 'Working' });
      const errorInstance = createMockInstance({ status: 'error', name: 'Error' });

      useInstancesStore.setState({
        instances: [idleInstance, workingInstance, errorInstance],
      });

      const { result } = renderHook(() => useQueueMode());

      expect(result.current.idleInstances).toHaveLength(1);
      expect(result.current.idleInstances[0].name).toBe('Idle 1');
    });

    it('returns empty array when no idle instances', () => {
      const workingInstance = createMockInstance({ status: 'working' });

      useInstancesStore.setState({
        instances: [workingInstance],
      });

      const { result } = renderHook(() => useQueueMode());

      expect(result.current.idleInstances).toHaveLength(0);
      expect(result.current.isEmpty).toBe(true);
    });

    it('excludes skipped instances by default', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'Idle 1' });
      const idle2 = createMockInstance({ status: 'idle', name: 'Idle 2' });

      useInstancesStore.setState({
        instances: [idle1, idle2],
      });

      const { result } = renderHook(() => useQueueMode());

      // Skip the first instance
      act(() => {
        result.current.skip();
      });

      expect(result.current.idleInstances).toHaveLength(1);
      expect(result.current.idleInstances[0].name).toBe('Idle 2');
    });

    it('includes skipped instances when includeSkipped is true', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'Idle 1' });
      const idle2 = createMockInstance({ status: 'idle', name: 'Idle 2' });

      useInstancesStore.setState({
        instances: [idle1, idle2],
      });

      const { result, rerender } = renderHook(
        ({ includeSkipped }) => useQueueMode({ includeSkipped }),
        { initialProps: { includeSkipped: false } }
      );

      // Skip first instance
      act(() => {
        result.current.skip();
      });

      expect(result.current.idleInstances).toHaveLength(1);

      // Re-render with includeSkipped: true
      rerender({ includeSkipped: true });

      expect(result.current.idleInstances).toHaveLength(2);
    });
  });

  describe('navigation', () => {
    it('returns currentInstance at currentIndex', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'First' });
      const idle2 = createMockInstance({ status: 'idle', name: 'Second' });

      useInstancesStore.setState({
        instances: [idle1, idle2],
      });

      const { result } = renderHook(() => useQueueMode());

      expect(result.current.currentInstance?.name).toBe('First');
      expect(result.current.currentIndex).toBe(0);
    });

    it('advances to next instance with next()', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'First' });
      const idle2 = createMockInstance({ status: 'idle', name: 'Second' });

      useInstancesStore.setState({
        instances: [idle1, idle2],
      });

      const { result } = renderHook(() => useQueueMode());

      act(() => {
        result.current.next();
      });

      expect(result.current.currentInstance?.name).toBe('Second');
      expect(result.current.currentIndex).toBe(1);
    });

    it('does not go past last instance with next()', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'Only' });

      useInstancesStore.setState({
        instances: [idle1],
      });

      const { result } = renderHook(() => useQueueMode());

      act(() => {
        result.current.next();
        result.current.next();
        result.current.next();
      });

      expect(result.current.currentIndex).toBe(0);
    });

    it('goes back with previous()', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'First' });
      const idle2 = createMockInstance({ status: 'idle', name: 'Second' });

      useInstancesStore.setState({
        instances: [idle1, idle2],
      });

      const { result } = renderHook(() => useQueueMode());

      act(() => {
        result.current.next();
      });

      expect(result.current.currentIndex).toBe(1);

      act(() => {
        result.current.previous();
      });

      expect(result.current.currentIndex).toBe(0);
    });

    it('does not go before first instance with previous()', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'First' });

      useInstancesStore.setState({
        instances: [idle1],
      });

      const { result } = renderHook(() => useQueueMode());

      act(() => {
        result.current.previous();
        result.current.previous();
      });

      expect(result.current.currentIndex).toBe(0);
    });
  });

  describe('skip', () => {
    it('adds current instance to skippedIds', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'First' });
      const idle2 = createMockInstance({ status: 'idle', name: 'Second' });

      useInstancesStore.setState({
        instances: [idle1, idle2],
      });

      const { result } = renderHook(() => useQueueMode());

      act(() => {
        result.current.skip();
      });

      expect(result.current.skippedIds.has(idle1.id)).toBe(true);
      expect(result.current.skippedIds.size).toBe(1);
    });

    it('shows next instance after skip', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'First' });
      const idle2 = createMockInstance({ status: 'idle', name: 'Second' });

      useInstancesStore.setState({
        instances: [idle1, idle2],
      });

      const { result } = renderHook(() => useQueueMode());

      act(() => {
        result.current.skip();
      });

      // After skip, the array shrinks but index stays at 0
      // so we should now be showing 'Second'
      expect(result.current.currentInstance?.name).toBe('Second');
    });
  });

  describe('reset', () => {
    it('clears skipped instances and resets index', () => {
      const idle1 = createMockInstance({ status: 'idle', name: 'First' });
      const idle2 = createMockInstance({ status: 'idle', name: 'Second' });

      useInstancesStore.setState({
        instances: [idle1, idle2],
      });

      const { result } = renderHook(() => useQueueMode());

      // Skip and advance
      act(() => {
        result.current.skip();
        result.current.next();
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.skippedIds.size).toBe(0);
      expect(result.current.currentIndex).toBe(0);
      expect(result.current.idleInstances).toHaveLength(2);
    });
  });

  describe('computed properties', () => {
    it('returns correct totalCount', () => {
      const instances = [
        createMockInstance({ status: 'idle' }),
        createMockInstance({ status: 'idle' }),
        createMockInstance({ status: 'working' }),
      ];

      useInstancesStore.setState({ instances });

      const { result } = renderHook(() => useQueueMode());

      expect(result.current.totalCount).toBe(2);
    });

    it('returns correct remainingCount', () => {
      const instances = [
        createMockInstance({ status: 'idle' }),
        createMockInstance({ status: 'idle' }),
        createMockInstance({ status: 'idle' }),
      ];

      useInstancesStore.setState({ instances });

      const { result } = renderHook(() => useQueueMode());

      expect(result.current.remainingCount).toBe(3);

      act(() => {
        result.current.next();
      });

      expect(result.current.remainingCount).toBe(2);
    });

    it('returns hasMore correctly', () => {
      const instances = [
        createMockInstance({ status: 'idle' }),
        createMockInstance({ status: 'idle' }),
      ];

      useInstancesStore.setState({ instances });

      const { result } = renderHook(() => useQueueMode());

      expect(result.current.hasMore).toBe(true);

      act(() => {
        result.current.next();
      });

      expect(result.current.hasMore).toBe(false);
    });

    it('returns isEmpty correctly', () => {
      useInstancesStore.setState({ instances: [] });

      const { result } = renderHook(() => useQueueMode());

      expect(result.current.isEmpty).toBe(true);
    });
  });

  describe('reactive updates', () => {
    it('updates when instance status changes', () => {
      const instance = createMockInstance({ status: 'idle', name: 'Test' });

      useInstancesStore.setState({ instances: [instance] });

      const { result } = renderHook(() => useQueueMode());

      expect(result.current.idleInstances).toHaveLength(1);

      // Simulate status change to working
      act(() => {
        useInstancesStore.setState({
          instances: [{ ...instance, status: 'working' }],
        });
      });

      expect(result.current.idleInstances).toHaveLength(0);
      expect(result.current.isEmpty).toBe(true);
    });
  });
});
