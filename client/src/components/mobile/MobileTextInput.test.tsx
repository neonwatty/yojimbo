import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileTextInput } from './MobileTextInput';
import { instancesApi } from '../../api/client';

// Mock the API client
vi.mock('../../api/client', () => ({
  instancesApi: {
    sendInput: vi.fn(),
  },
}));

describe('MobileTextInput', () => {
  const mockInstanceId = 'test-instance-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('collapsed state', () => {
    it('renders collapsed by default with expand button', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      expect(screen.getByTestId('mobile-text-input-collapsed')).toBeInTheDocument();
      expect(screen.getByTestId('expand-button')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-text-input-expanded')).not.toBeInTheDocument();
    });

    it('has accessible title on expand button', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      expect(screen.getByTestId('expand-button')).toHaveAttribute(
        'title',
        'Open text input (for speech-to-text)'
      );
    });
  });

  describe('expanding and collapsing', () => {
    it('expands when clicking the expand button', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));

      expect(screen.getByTestId('mobile-text-input-expanded')).toBeInTheDocument();
      expect(screen.queryByTestId('mobile-text-input-collapsed')).not.toBeInTheDocument();
    });

    it('collapses when clicking the collapse button', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      // Expand first
      fireEvent.click(screen.getByTestId('expand-button'));
      expect(screen.getByTestId('mobile-text-input-expanded')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByTestId('collapse-button'));
      expect(screen.getByTestId('mobile-text-input-collapsed')).toBeInTheDocument();
    });

    it('clears text when collapsing', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      // Expand
      fireEvent.click(screen.getByTestId('expand-button'));

      // Type some text
      const textarea = screen.getByTestId('text-input');
      fireEvent.change(textarea, { target: { value: 'test text' } });
      expect(textarea).toHaveValue('test text');

      // Collapse and expand again
      fireEvent.click(screen.getByTestId('collapse-button'));
      fireEvent.click(screen.getByTestId('expand-button'));

      // Text should be cleared
      expect(screen.getByTestId('text-input')).toHaveValue('');
    });
  });

  describe('text input', () => {
    it('updates text value on input', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      const textarea = screen.getByTestId('text-input');

      fireEvent.change(textarea, { target: { value: 'hello world' } });

      expect(textarea).toHaveValue('hello world');
    });

    it('has correct placeholder text', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));

      expect(screen.getByTestId('text-input')).toHaveAttribute(
        'placeholder',
        'Type or tap mic for speech...'
      );
    });

    it('disables autocomplete/autocorrect features', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      const textarea = screen.getByTestId('text-input');

      expect(textarea).toHaveAttribute('autocomplete', 'off');
      expect(textarea).toHaveAttribute('autocorrect', 'off');
      expect(textarea).toHaveAttribute('autocapitalize', 'off');
      expect(textarea).toHaveAttribute('spellcheck', 'false');
    });
  });

  describe('send button', () => {
    it('is disabled when text is empty', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));

      expect(screen.getByTestId('send-button')).toBeDisabled();
    });

    it('is disabled when text is only whitespace', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      fireEvent.change(screen.getByTestId('text-input'), { target: { value: '   ' } });

      expect(screen.getByTestId('send-button')).toBeDisabled();
    });

    it('is enabled when there is text', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'hello' } });

      expect(screen.getByTestId('send-button')).not.toBeDisabled();
    });

    it('sends text via API when clicked', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'test command' } });
      fireEvent.click(screen.getByTestId('send-button'));

      expect(instancesApi.sendInput).toHaveBeenCalledWith(mockInstanceId, 'test command');
    });

    it('clears text after sending', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'test command' } });
      fireEvent.click(screen.getByTestId('send-button'));

      expect(screen.getByTestId('text-input')).toHaveValue('');
    });
  });

  describe('send + enter button', () => {
    it('is disabled when text is empty', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));

      expect(screen.getByTestId('send-enter-button')).toBeDisabled();
    });

    it('is enabled when there is text', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'hello' } });

      expect(screen.getByTestId('send-enter-button')).not.toBeDisabled();
    });

    it('sends text with carriage return via API when clicked', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'test command' } });
      fireEvent.click(screen.getByTestId('send-enter-button'));

      expect(instancesApi.sendInput).toHaveBeenCalledWith(mockInstanceId, 'test command\r');
    });

    it('clears text after sending with enter', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      fireEvent.change(screen.getByTestId('text-input'), { target: { value: 'test command' } });
      fireEvent.click(screen.getByTestId('send-enter-button'));

      expect(screen.getByTestId('text-input')).toHaveValue('');
    });
  });

  describe('keyboard shortcuts', () => {
    it('sends with enter on Cmd+Enter (Mac)', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      const textarea = screen.getByTestId('text-input');
      fireEvent.change(textarea, { target: { value: 'test command' } });

      // Simulate Cmd+Enter
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

      expect(instancesApi.sendInput).toHaveBeenCalledWith(mockInstanceId, 'test command\r');
    });

    it('sends with enter on Ctrl+Enter (Windows/Linux)', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      const textarea = screen.getByTestId('text-input');
      fireEvent.change(textarea, { target: { value: 'test command' } });

      // Simulate Ctrl+Enter
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

      expect(instancesApi.sendInput).toHaveBeenCalledWith(mockInstanceId, 'test command\r');
    });

    it('does not send on regular Enter', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));
      const textarea = screen.getByTestId('text-input');
      fireEvent.change(textarea, { target: { value: 'test command' } });

      // Simulate regular Enter
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(instancesApi.sendInput).not.toHaveBeenCalled();
    });
  });

  describe('hint text', () => {
    it('shows hint text when expanded', () => {
      render(<MobileTextInput instanceId={mockInstanceId} />);

      fireEvent.click(screen.getByTestId('expand-button'));

      expect(
        screen.getByText(/Tap mic on keyboard for speech/)
      ).toBeInTheDocument();
    });
  });
});
