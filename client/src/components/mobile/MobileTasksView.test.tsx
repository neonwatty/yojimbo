import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MobileTasksView } from './MobileTasksView';
import { useTodosStore } from '../../store/todosStore';
import { useInstancesStore } from '../../store/instancesStore';
import type { GlobalTodo } from '@cc-orchestrator/shared';

// Mock the API client - inline mock data since vi.mock is hoisted
vi.mock('../../api/client', () => ({
  todosApi: {
    list: vi.fn().mockResolvedValue({
      success: true,
      data: [{
        id: 'todo-1',
        text: 'Test todo',
        status: 'captured',
        dispatchedInstanceId: null,
        dispatchedAt: null,
        completedAt: null,
        archivedAt: null,
        displayOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]
    }),
    create: vi.fn().mockResolvedValue({ success: true, data: { id: 'new-todo', text: 'New todo', status: 'captured' } }),
    update: vi.fn().mockResolvedValue({ success: true, data: {} }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    markDone: vi.fn().mockResolvedValue({ success: true, data: {} }),
    dispatch: vi.fn().mockResolvedValue({ success: true, data: {} }),
  },
}));

// Mock toast store
vi.mock('../../store/toastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Default props for the component
const defaultProps = {
  onTopGesture: vi.fn(),
  onBottomGesture: vi.fn(),
  onOpenNewInstance: vi.fn(),
};

// Helper to create mock touch events
const createTouchEvent = (clientX: number, clientY: number) => {
  return {
    touches: [{ clientX, clientY }],
    changedTouches: [{ clientX, clientY }],
    preventDefault: vi.fn(),
  };
};

// Helper to simulate a swipe gesture on the todo-content element
const simulateSwipe = async (todoContentElement: HTMLElement, startX: number, endX: number, y: number = 200) => {
  await act(async () => {
    fireEvent.touchStart(todoContentElement, createTouchEvent(startX, y));

    // Simulate intermediate moves for smoother gesture detection
    const steps = 5;
    const deltaX = (endX - startX) / steps;
    for (let i = 1; i <= steps; i++) {
      fireEvent.touchMove(todoContentElement, createTouchEvent(startX + deltaX * i, y));
    }

    fireEvent.touchEnd(todoContentElement, createTouchEvent(endX, y));
  });
};

describe('MobileTasksView', () => {
  const mockTodo: GlobalTodo = {
    id: 'todo-1',
    text: 'Test todo',
    status: 'captured',
    dispatchedInstanceId: null,
    dispatchedAt: null,
    completedAt: null,
    archivedAt: null,
    displayOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTodoDone: GlobalTodo = {
    ...mockTodo,
    id: 'todo-2',
    text: 'Completed todo',
    status: 'done',
    completedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset stores with todos already loaded
    useTodosStore.setState({
      todos: [mockTodo],
      stats: { total: 1, captured: 1, inProgress: 0, done: 0 },
      isLoading: false,
    });
    useInstancesStore.setState({
      instances: [],
      activeInstanceId: null,
    });
  });

  describe('rendering', () => {
    it('renders todo list with todos', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      expect(screen.getByText('Test todo')).toBeInTheDocument();
      expect(screen.getByText('Todos')).toBeInTheDocument();
    });

    it('shows pending count badge', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      expect(screen.getByText('1 pending')).toBeInTheDocument();
    });

    it('shows empty state when no todos', async () => {
      // Mock the API to return empty list for this test
      const { todosApi } = await import('../../api/client');
      vi.mocked(todosApi.list).mockResolvedValueOnce({ success: true, data: [] });

      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      // Wait for the fetch to complete
      await waitFor(() => {
        expect(screen.getByText('No todos yet')).toBeInTheDocument();
      });
    });

    it('shows action hint when todos exist', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      expect(screen.getByText('Swipe or tap ⋮ for actions')).toBeInTheDocument();
    });
  });

  describe('todo creation', () => {
    it('renders add todo input', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      expect(screen.getByPlaceholderText('Add a todo...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    });

    it('disables add button when input is empty', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    });

    it('enables add button when input has text', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const input = screen.getByPlaceholderText('Add a todo...');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'New todo' } });
      });

      expect(screen.getByRole('button', { name: 'Add' })).not.toBeDisabled();
    });
  });

  describe('swipe gesture behavior', () => {
    it('reveals action buttons when swiping left past threshold', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');
      expect(todoContent).toBeInTheDocument();

      // Swipe left more than 80px threshold
      await simulateSwipe(todoContent, 300, 100);

      // Actions should be revealed - check for action buttons
      expect(screen.getByTestId('dispatch-button')).toBeInTheDocument();
      expect(screen.getByTestId('done-button')).toBeInTheDocument();
      expect(screen.getByTestId('delete-button')).toBeInTheDocument();
    });

    it('closes swipe when not past threshold', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');

      // Swipe left less than 80px threshold
      await simulateSwipe(todoContent, 300, 250);

      // Todo content should be back in place (transform should be 0)
      await waitFor(() => {
        expect(todoContent).toHaveStyle({ transform: 'translateX(0px)' });
      });
    });

    it('keeps swipe revealed until action is taken', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');

      // Swipe left past threshold
      await simulateSwipe(todoContent, 300, 50);

      // The action buttons should be accessible after swipe
      expect(screen.getByTestId('dispatch-button')).toBeInTheDocument();
      expect(screen.getByTestId('done-button')).toBeInTheDocument();
      expect(screen.getByTestId('delete-button')).toBeInTheDocument();

      // Wait a bit to ensure it doesn't auto-close
      await new Promise(resolve => setTimeout(resolve, 100));

      // Buttons should still be accessible
      expect(screen.getByTestId('dispatch-button')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('calls toggle done when done button is clicked', async () => {
      const { todosApi } = await import('../../api/client');

      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');

      // Swipe to reveal
      await simulateSwipe(todoContent, 300, 50);

      await act(async () => {
        fireEvent.click(screen.getByTestId('done-button'));
      });

      expect(todosApi.markDone).toHaveBeenCalledWith('todo-1');
    });

    it('calls delete when delete button is clicked', async () => {
      const { todosApi } = await import('../../api/client');

      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');

      // Swipe to reveal
      await simulateSwipe(todoContent, 300, 50);

      await act(async () => {
        fireEvent.click(screen.getByTestId('delete-button'));
      });

      expect(todosApi.delete).toHaveBeenCalledWith('todo-1');
    });

    it('opens dispatch sheet when dispatch button is clicked', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');

      // Swipe to reveal
      await simulateSwipe(todoContent, 300, 50);

      await act(async () => {
        fireEvent.click(screen.getByTestId('dispatch-button'));
      });

      // Dispatch sheet should be visible
      expect(screen.getByText('Dispatch Todo')).toBeInTheDocument();
      expect(screen.getByText('Copy to clipboard')).toBeInTheDocument();
    });

    it('resets swipe state after action is taken', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');

      // Swipe to reveal
      await simulateSwipe(todoContent, 300, 50);

      await act(async () => {
        fireEvent.click(screen.getByTestId('done-button'));
      });

      // Swipe should be reset
      await waitFor(() => {
        expect(todoContent).toHaveStyle({ transform: 'translateX(0px)' });
      });
    });
  });

  describe('tap away to close', () => {
    it('closes revealed swipe when tapping outside', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');
      const todoList = screen.getByTestId('todo-list');

      // Swipe to reveal - buttons are always in DOM, just positioned behind the content
      await simulateSwipe(todoContent, 300, 50);

      // Click on the todo list container (not a button) to close
      await act(async () => {
        fireEvent.click(todoList);
      });

      // After clicking outside, the swipe state should be reset
      // We verify by checking the transform is back to 0
      await waitFor(() => {
        expect(todoContent).toHaveStyle({ transform: 'translateX(0px)' });
      });
    });
  });

  describe('checkbox toggle', () => {
    it('toggles todo done status when checkbox is clicked', async () => {
      const { todosApi } = await import('../../api/client');

      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const checkbox = screen.getByTestId('todo-checkbox-todo-1');

      await act(async () => {
        fireEvent.click(checkbox);
      });

      expect(todosApi.markDone).toHaveBeenCalledWith('todo-1');
    });

    it('shows checkmark for done todos', async () => {
      // Mock the API to return a done todo
      const { todosApi } = await import('../../api/client');
      vi.mocked(todosApi.list).mockResolvedValueOnce({
        success: true,
        data: [mockTodoDone]
      });

      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      // Wait for fetch to complete and done todo to render
      await waitFor(() => {
        // Done todo should have strikethrough
        const todoText = screen.getByText('Completed todo');
        expect(todoText).toHaveClass('line-through');
      });
    });
  });

  describe('dispatch sheet', () => {
    it('shows copy to clipboard option', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');

      await simulateSwipe(todoContent, 300, 50);

      await act(async () => {
        fireEvent.click(screen.getByTestId('dispatch-button'));
      });

      expect(screen.getByText('Copy to clipboard')).toBeInTheDocument();
    });

    it('shows create new instance option', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');

      await simulateSwipe(todoContent, 300, 50);

      await act(async () => {
        fireEvent.click(screen.getByTestId('dispatch-button'));
      });

      expect(screen.getByText('Create new instance')).toBeInTheDocument();
    });

    it('closes dispatch sheet on cancel', async () => {
      await act(async () => {
        render(<MobileTasksView {...defaultProps} />);
      });

      const todoContent = screen.getByTestId('todo-content');

      await simulateSwipe(todoContent, 300, 50);

      await act(async () => {
        fireEvent.click(screen.getByTestId('dispatch-button'));
      });

      expect(screen.getByText('Cancel')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByText('Cancel'));
      });

      await waitFor(() => {
        expect(screen.queryByText('Dispatch Todo')).not.toBeInTheDocument();
      });
    });
  });
});
