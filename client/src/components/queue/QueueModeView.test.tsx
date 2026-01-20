import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueueModeView } from './QueueModeView';
import { useUIStore } from '../../store/uiStore';
import type { Instance } from '@cc-orchestrator/shared';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock useQueueMode for specific tests
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
    useUIStore.setState({
      currentView: 'queue',
      setCurrentView: vi.fn(),
      queueModeActive: false,
      setQueueModeActive: vi.fn(),
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

    it('back button navigates to instances view from empty state', async () => {
      const mockSetCurrentView = vi.fn();
      const mockSetQueueModeActive = vi.fn();
      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          isEmpty: true,
          totalCount: 0,
        })
      );
      useUIStore.setState({
        setCurrentView: mockSetCurrentView,
        setQueueModeActive: mockSetQueueModeActive,
      });

      await act(async () => {
        render(<QueueModeView />);
      });

      const backButton = screen.getByText('Back to Instances');
      await act(async () => {
        fireEvent.click(backButton);
      });

      expect(mockSetQueueModeActive).toHaveBeenCalledWith(false);
      expect(mockSetCurrentView).toHaveBeenCalledWith('instances');
      expect(mockNavigate).toHaveBeenCalledWith('/instances');
    });
  });

  describe('navigation to instance', () => {
    it('navigates to first idle instance and activates queue mode', async () => {
      const mockSetQueueModeActive = vi.fn();
      const idleInstance = createMockInstance({
        id: 'test-instance-id',
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
      useUIStore.setState({
        setQueueModeActive: mockSetQueueModeActive,
      });

      await act(async () => {
        render(<QueueModeView />);
      });

      expect(mockSetQueueModeActive).toHaveBeenCalledWith(true);
      expect(mockNavigate).toHaveBeenCalledWith('/instances/test-instance-id', { replace: true });
    });
  });

  describe('queue complete state', () => {
    it('shows queue complete state when all instances are processed', async () => {
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

      const startOverButton = screen.getByText('Start Over');
      await act(async () => {
        fireEvent.click(startOverButton);
      });

      expect(mockReset).toHaveBeenCalled();
    });

    it('done button exits queue mode and navigates away', async () => {
      const mockSetCurrentView = vi.fn();
      const mockSetQueueModeActive = vi.fn();
      mockQueueMode.useQueueMode.mockReturnValue(
        createQueueModeReturn({
          currentInstance: undefined,
          currentIndex: 1,
          totalCount: 1,
          isEmpty: false,
          idleInstances: [],
        })
      );
      useUIStore.setState({
        setCurrentView: mockSetCurrentView,
        setQueueModeActive: mockSetQueueModeActive,
      });

      await act(async () => {
        render(<QueueModeView />);
      });

      const doneButton = screen.getByText('Done');
      await act(async () => {
        fireEvent.click(doneButton);
      });

      expect(mockSetQueueModeActive).toHaveBeenCalledWith(false);
      expect(mockSetCurrentView).toHaveBeenCalledWith('instances');
      expect(mockNavigate).toHaveBeenCalledWith('/instances');
    });
  });

  describe('loading state', () => {
    it('shows loading state briefly before navigation', async () => {
      // When currentInstance exists but we haven't navigated yet
      const idleInstance = createMockInstance({
        id: 'test-id',
        status: 'idle',
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

      // The component should have triggered navigation
      expect(mockNavigate).toHaveBeenCalled();
    });
  });
});
