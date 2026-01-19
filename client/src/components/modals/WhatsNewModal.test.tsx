import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WhatsNewModal } from './WhatsNewModal';

// Mock the API client
vi.mock('../../api/client', () => ({
  releasesApi: {
    list: vi.fn(),
  },
}));

// Mock the MDXPlanEditor component since it has complex dependencies
vi.mock('../plans/MDXPlanEditor', () => ({
  MDXPlanEditor: ({ markdown }: { markdown: string }) => (
    <div data-testid="mdx-editor">{markdown}</div>
  ),
}));

// Mock the Icons component
vi.mock('../common/Icons', () => ({
  Icons: {
    close: () => <span data-testid="close-icon">×</span>,
    link: () => <span data-testid="link-icon">🔗</span>,
  },
}));

import { releasesApi } from '../../api/client';

describe('WhatsNewModal', () => {
  const mockOnClose = vi.fn();

  const mockReleasesResponse = {
    success: true,
    data: [
      {
        version: 'v1.0.0',
        name: 'Release v1.0.0',
        body: '## Changes\n- Feature A',
        publishedAt: '2026-01-15T12:00:00Z',
        url: 'https://github.com/example/repo/releases/tag/v1.0.0',
        isPrerelease: false,
      },
      {
        version: 'v0.9.0',
        name: 'Release v0.9.0',
        body: '## Previous changes',
        publishedAt: '2026-01-10T12:00:00Z',
        url: 'https://github.com/example/repo/releases/tag/v0.9.0',
        isPrerelease: false,
      },
      {
        version: 'v1.1.0-beta',
        name: 'Beta Release',
        body: 'Beta features',
        publishedAt: '2026-01-16T12:00:00Z',
        url: 'https://github.com/example/repo/releases/tag/v1.1.0-beta',
        isPrerelease: true,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (releasesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue(mockReleasesResponse);
  });

  it('does not render when isOpen is false', () => {
    render(<WhatsNewModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText("What's New")).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
    });
  });

  it('fetches releases on open', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(releasesApi.list).toHaveBeenCalled();
    });
  });

  it('displays loading state initially', () => {
    (releasesApi.list as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Loading releases...')).toBeInTheDocument();
  });

  it('displays release list after loading', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      // Use getAllByText since v1.0.0 appears in both header and list
      expect(screen.getAllByText('v1.0.0').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('v0.9.0')).toBeInTheDocument();
      expect(screen.getByText('v1.1.0-beta')).toBeInTheDocument();
    });
  });

  it('auto-selects the first (latest) release', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      // The first release should be displayed in the details pane
      expect(screen.getByText('Release v1.0.0')).toBeInTheDocument();
    });
  });

  it('shows prerelease badge for prerelease versions', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('pre')).toBeInTheDocument();
    });
  });

  it('switches release when clicking on another version', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('v0.9.0')).toBeInTheDocument();
    });

    // Click on the second release
    fireEvent.click(screen.getByText('v0.9.0'));

    await waitFor(() => {
      expect(screen.getByText('Release v0.9.0')).toBeInTheDocument();
    });
  });

  it('displays error state when API fails', async () => {
    (releasesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: 'Failed to fetch releases',
    });

    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch releases')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('retries fetching when clicking Retry button', async () => {
    (releasesApi.list as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ success: false, error: 'Network error' })
      .mockResolvedValueOnce(mockReleasesResponse);

    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(releasesApi.list).toHaveBeenCalledTimes(2);
      // Use getAllByText since v1.0.0 appears in both header and list
      expect(screen.getAllByText('v1.0.0').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('calls onClose when clicking the close button', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByTestId('close-icon')).toBeInTheDocument();
    });

    // Find the close button (parent of the close icon)
    const closeIcon = screen.getByTestId('close-icon');
    fireEvent.click(closeIcon.closest('button')!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when pressing Escape key', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking the backdrop', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    // Click on the backdrop (outer div)
    const backdrop = screen.getByText("What's New").closest('.fixed');
    fireEvent.click(backdrop!);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside the modal content', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    // Click inside the modal content
    fireEvent.click(screen.getByText("What's New"));

    // onClose should NOT have been called
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('displays empty state when no releases found', async () => {
    (releasesApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });

    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      expect(screen.getByText('No releases found')).toBeInTheDocument();
    });
  });

  it('renders View on GitHub link', async () => {
    render(<WhatsNewModal isOpen={true} onClose={mockOnClose} />);

    await waitFor(() => {
      const link = screen.getByText('View on GitHub');
      expect(link).toBeInTheDocument();
      expect(link.closest('a')).toHaveAttribute(
        'href',
        'https://github.com/example/repo/releases/tag/v1.0.0'
      );
      expect(link.closest('a')).toHaveAttribute('target', '_blank');
    });
  });
});
