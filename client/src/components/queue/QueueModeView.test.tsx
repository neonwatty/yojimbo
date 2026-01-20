import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueueModeView } from './QueueModeView';
import { useInstancesStore } from '../../store/instancesStore';
import { useUIStore } from '../../store/uiStore';
import type { Instance } from '@cc-orchestrator/shared';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock useWebSocket hook
const mockSend = vi.fn();
vi.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    send: mockSend,
    isConnected: true,
  }),
}));

// Mock config
vi.mock('../../config', () => ({
  getWsUrl: () => 'ws://localhost:3000',
}));

// Mock useQueueMode for specific tests - will be overridden in tests that need it
const mockSkip = vi.fn();
const mockReset = vi.fn();
const mockQueueMode = vi.hoisted(() => ({
  useQueueMode: vi.fn(),
}));
vi.mock('../../hooks/useQueueMode', () => mockQueueMode);

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

// Helper to create default queue mode return value
function createQueueModeReturn(overrides = {}) {
  return {
    idleInstances: [],
    currentInstance: undefined,
    currentIndex: 0,
    totalCount: 0,
    remainingCount: 0,
    hasMore: false,
    isEmpty: true,
    next: vi.fn(),
    previous: vi.fn(),
    skip: mockSkip,
    reset: mockReset,
    skippedIds: new Set<string>(),
    ...overrides,
  };
}

describe('QueueModeView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores before each test
    useInstancesStore.setState({
      instances: [],
      expandedInstanceId: null,
      setExpandedInstanceId: vi.fn(),
    });
    useUIStore.setState({
      currentView: 'queue',
      setCurrentView: vi.fn(),
    });
    // Reset the mock to default empty state
    mockQueueMode.useQueueMode.mockReturnValue(createQueueModeReturn());
  });

  describe('empty state', () => {
    it('renders empty state when no idle instances', async () => {
      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          isEmpty: true,
          totalCount: 0,
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      expect(screen.getByText('All caught up!')).toBeInTheDocument();
      expect(
        screen.getByText(/No idle instances need attention right now/)
      ).toBeInTheDocument();
      expect(screen.getByText('Back to Instances')).toBeInTheDocument();
    });

    it('renders empty state when all instances are working', async () => {
      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          isEmpty: true,
          totalCount: 0,
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      expect(screen.getByText('All caught up!')).toBeInTheDocument();
    });

    it('back button navigates to instances view from empty state', async () => {
      const mockSetCurrentView = vi.fn();
      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          isEmpty: true,
          totalCount: 0,
        })
      );
      useUIStore.setState({ setCurrentView: mockSetCurrentView });

      await act(async () => {
        render(<QueueModeView />);
      });

      const backButton = screen.getByText('Back to Instances');
      await act(async () => {
        fireEvent.click(backButton);
      });

      expect(mockSetCurrentView).toHaveBeenCalledWith('instances');
      expect(mockNavigate).toHaveBeenCalledWith('/instances');
    });
  });

  describe('instance card rendering', () => {
    it('renders instance card when idle instances exist', async () => {
      const idleInstance = createMockInstance({
        id: 'test-id',
        status: 'idle',
        name: 'Idle Instance',
        workingDir: '/projects/myapp',
      });

      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: idleInstance,
          currentIndex: 0,
          totalCount: 1,
          isEmpty: false,
          idleInstances: [idleInstance],
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      expect(screen.getByText('Idle Instance')).toBeInTheDocument();
      expect(screen.getByText('/projects/myapp')).toBeInTheDocument();
      expect(screen.getByText('Review Idle Instances')).toBeInTheDocument();
    });

    it('shows command input for current instance', async () => {
      const idleInstance = createMockInstance({
        id: 'test-id',
        status: 'idle',
        name: 'Test Instance',
      });

      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: idleInstance,
          currentIndex: 0,
          totalCount: 1,
          isEmpty: false,
          idleInstances: [idleInstance],
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      expect(
        screen.getByPlaceholderText('Enter command to run...')
      ).toBeInTheDocument();
    });
  });

  describe('progress indicator', () => {
    it('shows progress indicator with correct count', async () => {
      const idleInstances = [
        createMockInstance({ id: 'i1', status: 'idle', name: 'Instance 1' }),
        createMockInstance({ id: 'i2', status: 'idle', name: 'Instance 2' }),
        createMockInstance({ id: 'i3', status: 'idle', name: 'Instance 3' }),
      ];

      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: idleInstances[0],
          currentIndex: 0,
          totalCount: 3,
          isEmpty: false,
          idleInstances,
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      // QueueProgress displays "current + 1 of total idle"
      expect(screen.getByText('1 of 3 idle')).toBeInTheDocument();
    });
  });

  describe('skip functionality', () => {
    it('skip button calls skip function from hook', async () => {
      const idleInstance = createMockInstance({
        id: 'i1',
        status: 'idle',
        name: 'Instance 1',
      });

      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: idleInstance,
          currentIndex: 0,
          totalCount: 2,
          isEmpty: false,
          idleInstances: [idleInstance],
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      expect(screen.getByText('Instance 1')).toBeInTheDocument();

      // Click the skip button in the QueueCard
      const skipButton = screen.getByRole('button', { name: /Skip/i });
      await act(async () => {
        fireEvent.click(skipButton);
      });

      expect(mockSkip).toHaveBeenCalled();
    });
  });

  describe('queue complete state', () => {
    it('shows queue complete state when all instances are processed', async () => {
      // This state occurs when currentInstance is undefined but totalCount > 0
      // This can happen when the index goes past the end of the array
      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: undefined,
          currentIndex: 3,
          totalCount: 3,
          isEmpty: false,
          idleInstances: [],
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      // Queue complete state should be shown
      expect(screen.getByText('Queue complete!')).toBeInTheDocument();
      expect(
        screen.getByText(/You've reviewed all 3 idle instances/)
      ).toBeInTheDocument();
      expect(screen.getByText('Start Over')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('reset button calls reset function from hook', async () => {
      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: undefined,
          currentIndex: 1,
          totalCount: 1,
          isEmpty: false,
          idleInstances: [],
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      expect(screen.getByText('Queue complete!')).toBeInTheDocument();

      // Click Start Over
      const startOverButton = screen.getByText('Start Over');
      await act(async () => {
        fireEvent.click(startOverButton);
      });

      expect(mockReset).toHaveBeenCalled();
    });

    it('done button navigates away from queue', async () => {
      const mockSetCurrentView = vi.fn();
      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: undefined,
          currentIndex: 1,
          totalCount: 1,
          isEmpty: false,
          idleInstances: [],
        })
      );
      useUIStore.setState({ setCurrentView: mockSetCurrentView });

      await act(async () => {
        render(<QueueModeView />);
      });

      // Click Done
      const doneButton = screen.getByText('Done');
      await act(async () => {
        fireEvent.click(doneButton);
      });

      expect(mockSetCurrentView).toHaveBeenCalledWith('instances');
      expect(mockNavigate).toHaveBeenCalledWith('/instances');
    });
  });

  describe('exit functionality', () => {
    it('close button exits queue mode and navigates to instances', async () => {
      const mockSetCurrentView = vi.fn();
      const idleInstance = createMockInstance({
        id: 'test-id',
        status: 'idle',
        name: 'Test Instance',
      });

      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: idleInstance,
          currentIndex: 0,
          totalCount: 1,
          isEmpty: false,
          idleInstances: [idleInstance],
        })
      );
      useUIStore.setState({ setCurrentView: mockSetCurrentView });

      await act(async () => {
        render(<QueueModeView />);
      });

      // Click the close button (exit queue mode)
      const closeButton = screen.getByTitle('Exit queue mode');
      await act(async () => {
        fireEvent.click(closeButton);
      });

      expect(mockSetCurrentView).toHaveBeenCalledWith('instances');
      expect(mockNavigate).toHaveBeenCalledWith('/instances');
    });
  });

  describe('expand functionality', () => {
    it('open terminal button expands instance and navigates', async () => {
      const mockSetExpandedInstanceId = vi.fn();
      const idleInstance = createMockInstance({
        id: 'test-instance-123',
        status: 'idle',
        name: 'Test Instance',
      });

      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: idleInstance,
          currentIndex: 0,
          totalCount: 1,
          isEmpty: false,
          idleInstances: [idleInstance],
        })
      );
      useInstancesStore.setState({
        setExpandedInstanceId: mockSetExpandedInstanceId,
      });

      await act(async () => {
        render(<QueueModeView />);
      });

      const expandButton = screen.getByRole('button', { name: /Open Terminal/i });
      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(mockSetExpandedInstanceId).toHaveBeenCalledWith('test-instance-123');
      expect(mockNavigate).toHaveBeenCalledWith('/instances/test-instance-123');
    });
  });

  describe('command submission', () => {
    it('sends command via WebSocket and calls skip', async () => {
      const idleInstance = createMockInstance({
        id: 'instance-1',
        status: 'idle',
        name: 'Instance 1',
      });

      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: idleInstance,
          currentIndex: 0,
          totalCount: 2,
          isEmpty: false,
          idleInstances: [idleInstance],
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      expect(screen.getByText('Instance 1')).toBeInTheDocument();

      // Type a command
      const input = screen.getByPlaceholderText('Enter command to run...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'npm test' } });
      });

      // Submit the command (click submit button)
      const submitButton = screen.getByTitle('Send command');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Verify WebSocket send was called
      expect(mockSend).toHaveBeenCalledWith('terminal:input', {
        instanceId: 'instance-1',
        data: 'npm test\n',
      });

      // Verify skip was called to advance to next instance
      expect(mockSkip).toHaveBeenCalled();
    });
  });

  describe('keyboard hints', () => {
    it('displays keyboard shortcut hints', async () => {
      const idleInstance = createMockInstance({
        id: 'test-id',
        status: 'idle',
        name: 'Test Instance',
      });

      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: idleInstance,
          currentIndex: 0,
          totalCount: 1,
          isEmpty: false,
          idleInstances: [idleInstance],
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      // Check for the kbd elements with arrow keys
      expect(screen.getByText('←')).toBeInTheDocument();
      expect(screen.getByText('Enter')).toBeInTheDocument();
      expect(screen.getByText('→')).toBeInTheDocument();
      expect(screen.getByText('Esc')).toBeInTheDocument();
    });
  });

  describe('status badge', () => {
    it('renders status badge for idle instance', async () => {
      const idleInstance = createMockInstance({
        id: 'test-id',
        status: 'idle',
        name: 'Idle Instance',
      });

      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: idleInstance,
          currentIndex: 0,
          totalCount: 1,
          isEmpty: false,
          idleInstances: [idleInstance],
        })
      );

      await act(async () => {
        render(<QueueModeView />);
      });

      // StatusBadge renders the status text
      expect(screen.getByText('Idle')).toBeInTheDocument();
    });
  });
});
