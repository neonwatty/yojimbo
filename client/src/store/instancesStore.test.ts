import { describe, it, expect, beforeEach } from 'vitest';
import { useInstancesStore } from './instancesStore';
import type { Instance } from '@cc-orchestrator/shared';

const createMockInstance = (id: string, overrides?: Partial<Instance>): Instance => ({
  id,
  name: `Instance ${id}`,
  status: 'idle',
  workingDir: `/home/user/${id}`,
  isPinned: false,
  displayOrder: 0,
  pid: null,
  machineType: 'local',
  machineId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  closedAt: null,
  ...overrides,
});

describe('instancesStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useInstancesStore.setState({
      instances: [],
      activeInstanceId: null,
      expandedInstanceId: null,
      currentCwds: {},
    });
  });

  describe('setInstances', () => {
    it('replaces all instances', () => {
      const instances = [createMockInstance('1'), createMockInstance('2')];
      useInstancesStore.getState().setInstances(instances);

      expect(useInstancesStore.getState().instances).toEqual(instances);
    });
  });

  describe('addInstance', () => {
    it('adds a new instance to the list', () => {
      const instance = createMockInstance('1');
      useInstancesStore.getState().addInstance(instance);

      expect(useInstancesStore.getState().instances).toHaveLength(1);
      expect(useInstancesStore.getState().instances[0]).toEqual(instance);
    });

    it('appends to existing instances', () => {
      const instance1 = createMockInstance('1');
      const instance2 = createMockInstance('2');

      useInstancesStore.getState().addInstance(instance1);
      useInstancesStore.getState().addInstance(instance2);

      expect(useInstancesStore.getState().instances).toHaveLength(2);
      expect(useInstancesStore.getState().instances[0].id).toBe('1');
      expect(useInstancesStore.getState().instances[1].id).toBe('2');
    });
  });

  describe('updateInstance', () => {
    it('updates an existing instance', () => {
      const instance = createMockInstance('1', { status: 'idle' });
      useInstancesStore.getState().setInstances([instance]);

      useInstancesStore.getState().updateInstance('1', { status: 'working' });

      expect(useInstancesStore.getState().instances[0].status).toBe('working');
    });

    it('does not modify other instances', () => {
      const instances = [
        createMockInstance('1', { status: 'idle' }),
        createMockInstance('2', { status: 'idle' }),
      ];
      useInstancesStore.getState().setInstances(instances);

      useInstancesStore.getState().updateInstance('1', { status: 'working' });

      expect(useInstancesStore.getState().instances[0].status).toBe('working');
      expect(useInstancesStore.getState().instances[1].status).toBe('idle');
    });
  });

  describe('removeInstance', () => {
    it('removes an instance from the list', () => {
      const instances = [createMockInstance('1'), createMockInstance('2')];
      useInstancesStore.getState().setInstances(instances);

      useInstancesStore.getState().removeInstance('1');

      expect(useInstancesStore.getState().instances).toHaveLength(1);
      expect(useInstancesStore.getState().instances[0].id).toBe('2');
    });

    it('clears activeInstanceId if removing the active instance', () => {
      const instance = createMockInstance('1');
      useInstancesStore.setState({
        instances: [instance],
        activeInstanceId: '1',
      });

      useInstancesStore.getState().removeInstance('1');

      expect(useInstancesStore.getState().activeInstanceId).toBeNull();
    });

    it('clears expandedInstanceId if removing the expanded instance', () => {
      const instance = createMockInstance('1');
      useInstancesStore.setState({
        instances: [instance],
        expandedInstanceId: '1',
      });

      useInstancesStore.getState().removeInstance('1');

      expect(useInstancesStore.getState().expandedInstanceId).toBeNull();
    });

    it('removes current working directory for the instance', () => {
      const instance = createMockInstance('1');
      useInstancesStore.setState({
        instances: [instance],
        currentCwds: { '1': '/home/user/project' },
      });

      useInstancesStore.getState().removeInstance('1');

      expect(useInstancesStore.getState().currentCwds).not.toHaveProperty('1');
    });

    it('preserves activeInstanceId if removing a different instance', () => {
      const instances = [createMockInstance('1'), createMockInstance('2')];
      useInstancesStore.setState({
        instances,
        activeInstanceId: '1',
      });

      useInstancesStore.getState().removeInstance('2');

      expect(useInstancesStore.getState().activeInstanceId).toBe('1');
    });
  });

  describe('setActiveInstanceId', () => {
    it('sets the active instance ID', () => {
      useInstancesStore.getState().setActiveInstanceId('1');
      expect(useInstancesStore.getState().activeInstanceId).toBe('1');
    });

    it('can set to null', () => {
      useInstancesStore.setState({ activeInstanceId: '1' });
      useInstancesStore.getState().setActiveInstanceId(null);
      expect(useInstancesStore.getState().activeInstanceId).toBeNull();
    });
  });

  describe('reorderInstances', () => {
    it('reorders instances according to the provided IDs', () => {
      const instances = [
        createMockInstance('1'),
        createMockInstance('2'),
        createMockInstance('3'),
      ];
      useInstancesStore.getState().setInstances(instances);

      useInstancesStore.getState().reorderInstances(['3', '1', '2']);

      const reordered = useInstancesStore.getState().instances;
      expect(reordered[0].id).toBe('3');
      expect(reordered[1].id).toBe('1');
      expect(reordered[2].id).toBe('2');
    });

    it('filters out non-existent IDs', () => {
      const instances = [createMockInstance('1'), createMockInstance('2')];
      useInstancesStore.getState().setInstances(instances);

      useInstancesStore.getState().reorderInstances(['1', 'nonexistent', '2']);

      const reordered = useInstancesStore.getState().instances;
      expect(reordered).toHaveLength(2);
      expect(reordered[0].id).toBe('1');
      expect(reordered[1].id).toBe('2');
    });
  });

  describe('setCurrentCwd', () => {
    it('sets the current working directory for an instance', () => {
      useInstancesStore.getState().setCurrentCwd('1', '/home/user/project');

      expect(useInstancesStore.getState().currentCwds['1']).toBe('/home/user/project');
    });

    it('updates existing cwd for an instance', () => {
      useInstancesStore.setState({ currentCwds: { '1': '/old/path' } });

      useInstancesStore.getState().setCurrentCwd('1', '/new/path');

      expect(useInstancesStore.getState().currentCwds['1']).toBe('/new/path');
    });

    it('preserves cwds for other instances', () => {
      useInstancesStore.setState({ currentCwds: { '1': '/path/one' } });

      useInstancesStore.getState().setCurrentCwd('2', '/path/two');

      expect(useInstancesStore.getState().currentCwds['1']).toBe('/path/one');
      expect(useInstancesStore.getState().currentCwds['2']).toBe('/path/two');
    });
  });
});
