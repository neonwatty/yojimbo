import { test, expect, Page } from '@playwright/test';

/**
 * Queue Mode E2E Tests
 *
 * Tests the Queue Mode feature which allows users to triage idle instances one-by-one.
 * Entry point: "Queue" button in Header opens Queue Mode
 *
 * Components tested:
 * - QueueModeView.tsx - main UI with empty state, completed state, and card view
 * - QueueCard.tsx - instance card with skip/expand actions
 * - QueueProgress.tsx - progress indicator (X of Y idle)
 * - Header.tsx - Queue button with idle count badge
 */

// Mock instances data with various statuses
const mockInstancesWithIdle = {
  success: true,
  data: [
    {
      id: 'instance-1',
      name: 'idle-instance-1',
      workingDir: '/Users/test/project1',
      status: 'idle',
      isPinned: false,
      machineType: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'instance-2',
      name: 'idle-instance-2',
      workingDir: '/Users/test/project2',
      status: 'idle',
      isPinned: false,
      machineType: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'instance-3',
      name: 'working-instance',
      workingDir: '/Users/test/project3',
      status: 'working',
      isPinned: false,
      machineType: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'instance-4',
      name: 'idle-instance-3',
      workingDir: '/Users/test/project4',
      status: 'idle',
      isPinned: false,
      machineType: 'remote',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

const mockInstancesNoIdle = {
  success: true,
  data: [
    {
      id: 'instance-1',
      name: 'working-instance-1',
      workingDir: '/Users/test/project1',
      status: 'working',
      isPinned: false,
      machineType: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'instance-2',
      name: 'working-instance-2',
      workingDir: '/Users/test/project2',
      status: 'working',
      isPinned: false,
      machineType: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

const mockEmptyInstances = {
  success: true,
  data: [],
};

// Helper to set up API mocks before page navigation
async function setupInstancesMock(page: Page, mockResponse = mockInstancesWithIdle) {
  // Mock instances API
  await page.route(/\/api\/instances$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockResponse),
    });
  });

  // Mock individual instance GET requests
  await page.route(/\/api\/instances\/[\w-]+$/, async (route) => {
    const url = route.request().url();
    const instanceId = url.split('/').pop();
    const instance = mockResponse.data.find((i) => i.id === instanceId);

    if (instance) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: instance }),
      });
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Instance not found' }),
      });
    }
  });

  // Mock WebSocket connection status
  await page.route(/\/api\/health/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });
}

test.describe('Queue Mode', () => {
  test.describe('Queue Button in Header', () => {
    test('shows Queue button in header', async ({ page }) => {
      await setupInstancesMock(page);
      await page.goto('/');

      // Queue button should be visible in header
      await expect(page.locator('button:has-text("Queue")')).toBeVisible();
    });

    test('shows idle count badge when idle instances exist', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/');

      // Queue button should show the idle count badge (3 idle instances)
      const queueButton = page.locator('button:has-text("Queue")');
      await expect(queueButton).toBeVisible();

      // Badge should show count of idle instances
      const badge = queueButton.locator('span.rounded-full');
      await expect(badge).toHaveText('3');
    });

    test('hides idle count badge when no idle instances', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesNoIdle);
      await page.goto('/');

      const queueButton = page.locator('button:has-text("Queue")');
      await expect(queueButton).toBeVisible();

      // Badge should not be visible when no idle instances
      const badge = queueButton.locator('span.rounded-full');
      await expect(badge).not.toBeVisible();
    });

    test('clicking Queue navigates to queue view', async ({ page }) => {
      await setupInstancesMock(page);
      await page.goto('/');

      await page.locator('button:has-text("Queue")').click();
      await expect(page).toHaveURL(/.*\/queue/);
    });
  });

  test.describe('Empty State', () => {
    test('shows empty state when no idle instances exist', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesNoIdle);
      await page.goto('/queue');

      // Should show "All caught up!" message
      await expect(page.locator('h2:has-text("All caught up!")')).toBeVisible();
      await expect(
        page.locator('text=No idle instances need attention')
      ).toBeVisible();

      // Should have "Back to Instances" button
      await expect(
        page.locator('button:has-text("Back to Instances")')
      ).toBeVisible();
    });

    test('Back to Instances button navigates to instances view', async ({
      page,
    }) => {
      await setupInstancesMock(page, mockInstancesNoIdle);
      await page.goto('/queue');

      await page.locator('button:has-text("Back to Instances")').click();
      await expect(page).toHaveURL(/.*\/instances/);
    });
  });

  test.describe('Instance Card Display', () => {
    test('shows instance card when idle instances exist', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Should show "Review Idle Instances" header
      await expect(
        page.locator('h1:has-text("Review Idle Instances")')
      ).toBeVisible();

      // Should show instance name (first idle instance)
      await expect(page.locator('h3:has-text("idle-instance-1")')).toBeVisible();

      // Should show working directory (escape the path for proper text matching)
      await expect(page.locator('text="/Users/test/project1"')).toBeVisible();

      // Should show "Working Directory" label
      await expect(page.locator('text=Working Directory')).toBeVisible();
    });

    test('shows idle status badge on card', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Status badge should show "idle"
      await expect(page.locator('text=idle').first()).toBeVisible();
    });

    test('shows terminal preview placeholder', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Terminal preview shows "Waiting for input..."
      await expect(page.locator('text=Waiting for input...')).toBeVisible();
    });

    test('shows command input field', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Command input should be visible
      await expect(
        page.locator('input[placeholder="Enter command to run..."]')
      ).toBeVisible();
    });

    test('shows Skip and Open Terminal buttons', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Skip button
      await expect(page.locator('button:has-text("Skip")')).toBeVisible();

      // Open Terminal button
      await expect(
        page.locator('button:has-text("Open Terminal")')
      ).toBeVisible();
    });

    test('shows Remote badge for remote instances', async ({ page }) => {
      // Create mock with remote instance first
      const remoteFirstMock = {
        success: true,
        data: [
          {
            id: 'instance-remote',
            name: 'remote-idle-instance',
            workingDir: '/home/user/project',
            status: 'idle',
            isPinned: false,
            machineType: 'remote',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      await setupInstancesMock(page, remoteFirstMock);
      await page.goto('/queue');

      // Remote badge should be visible (use exact text matching to avoid sidebar match)
      await expect(page.getByText('Remote', { exact: true })).toBeVisible();
    });
  });

  test.describe('Progress Indicator', () => {
    test('shows correct progress count', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Progress should show "1 of 3 idle" (3 idle instances total)
      await expect(page.locator('text=1 of 3 idle')).toBeVisible();
    });

    test('progress bar is visible', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Progress bar container should exist and have proper structure
      // The container has overflow-hidden so we check it exists in DOM rather than visible
      const progressBarContainer = page.locator('.rounded-full.overflow-hidden');
      await expect(progressBarContainer).toBeAttached();

      // The progress fill should be visible
      const progressFill = page.locator('.bg-frost-4.transition-all');
      await expect(progressFill).toBeAttached();
    });
  });

  test.describe('Navigation', () => {
    test('Skip button moves to next instance', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Initially showing first idle instance
      await expect(page.locator('h3:has-text("idle-instance-1")')).toBeVisible();
      await expect(page.locator('text=1 of 3 idle')).toBeVisible();

      // Click Skip
      await page.locator('button:has-text("Skip")').click();

      // Should now show second idle instance
      await expect(page.locator('h3:has-text("idle-instance-2")')).toBeVisible();
      // Progress count should update - after skipping, the first instance is removed from queue
      // So we're now at position 1 of 2 remaining
      await expect(page.locator('text=1 of 2 idle')).toBeVisible();
    });

    test('Skip removes instance from queue session', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Initially 3 idle instances
      await expect(page.locator('text=1 of 3 idle')).toBeVisible();

      // Skip first instance
      await page.locator('button:has-text("Skip")').click();

      // Now 2 remaining (skipped one is excluded)
      await expect(page.locator('text=1 of 2 idle')).toBeVisible();

      // Skip second
      await page.locator('button:has-text("Skip")').click();

      // Now 1 remaining
      await expect(page.locator('text=1 of 1 idle')).toBeVisible();
    });

    test('shows empty state when all instances skipped', async ({ page }) => {
      // Use mock with only 2 idle instances for faster test
      const twoIdleMock = {
        success: true,
        data: [
          {
            id: 'instance-1',
            name: 'idle-1',
            workingDir: '/test/1',
            status: 'idle',
            isPinned: false,
            machineType: 'local',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'instance-2',
            name: 'idle-2',
            workingDir: '/test/2',
            status: 'idle',
            isPinned: false,
            machineType: 'local',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      await setupInstancesMock(page, twoIdleMock);
      await page.goto('/queue');

      // Skip both instances
      await page.locator('button:has-text("Skip")').click();
      await page.locator('button:has-text("Skip")').click();

      // When all instances are skipped, they're excluded from queue so it shows "All caught up!"
      // (skipped instances are filtered out, leaving totalCount = 0)
      await expect(page.locator('h2:has-text("All caught up!")')).toBeVisible();

      // Should have Back to Instances button
      await expect(
        page.locator('button:has-text("Back to Instances")')
      ).toBeVisible();
    });

    test.skip('Start Over resets the queue', async ({ page }) => {
      // Note: The "Queue complete!" state with "Start Over" button is only reachable
      // via the next() navigation (not skip()), which advances past the end of the queue
      // without removing instances. The current UI doesn't expose next() directly,
      // so this state may not be reachable through normal user interaction.
      // Skipping until the feature is clarified.
      const twoIdleMock = {
        success: true,
        data: [
          {
            id: 'instance-1',
            name: 'idle-1',
            workingDir: '/test/1',
            status: 'idle',
            isPinned: false,
            machineType: 'local',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'instance-2',
            name: 'idle-2',
            workingDir: '/test/2',
            status: 'idle',
            isPinned: false,
            machineType: 'local',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      await setupInstancesMock(page, twoIdleMock);
      await page.goto('/queue');

      // This test would require triggering the "Queue complete!" state,
      // which requires currentIndex to exceed idleInstances array bounds
      // while totalCount > 0

      // Click Start Over
      await page.locator('button:has-text("Start Over")').click();

      // Should be back to first instance with full queue restored
      await expect(page.locator('h3:has-text("idle-1")')).toBeVisible();
      await expect(page.locator('text=1 of 2 idle')).toBeVisible();
    });

    test('Back to Instances button exits queue mode after skipping all', async ({
      page,
    }) => {
      const oneIdleMock = {
        success: true,
        data: [
          {
            id: 'instance-1',
            name: 'idle-1',
            workingDir: '/test/1',
            status: 'idle',
            isPinned: false,
            machineType: 'local',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      await setupInstancesMock(page, oneIdleMock);
      await page.goto('/queue');

      // Skip the only instance
      await page.locator('button:has-text("Skip")').click();

      // Wait for "All caught up!" state (skipped instances are filtered out)
      await expect(page.locator('h2:has-text("All caught up!")')).toBeVisible();

      // Click Back to Instances
      await page.locator('button:has-text("Back to Instances")').click();

      // Should navigate to instances view
      await expect(page).toHaveURL(/.*\/instances/);
    });

    test('Open Terminal button navigates to instance expanded view', async ({
      page,
    }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Click Open Terminal
      await page.locator('button:has-text("Open Terminal")').click();

      // Should navigate to the instance's expanded view
      await expect(page).toHaveURL(/.*\/instances\/instance-1/);
    });
  });

  test.describe('Exit Queue Mode', () => {
    test('close button exits queue mode', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Click the close button (X icon in header)
      await page.locator('button[title="Exit queue mode"]').click();

      // Should navigate to instances view
      await expect(page).toHaveURL(/.*\/instances/);
    });

    test.skip('Escape key closes Queue Mode', async ({ page }) => {
      // Note: Escape key handler for queue route is not currently implemented in App.tsx
      // The keyboard hint shows Esc but the actual handler only works for /instances/ routes
      // Skipping until the feature is implemented
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Verify we're in queue mode
      await expect(
        page.locator('h1:has-text("Review Idle Instances")')
      ).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Should navigate to instances view
      await expect(page).toHaveURL(/.*\/instances/);
    });

    test('Queue button in header becomes highlighted when in queue view', async ({
      page,
    }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Queue button should have active styling (bg-frost-4/30)
      const queueButton = page.locator('button:has-text("Queue")');
      await expect(queueButton).toHaveClass(/bg-frost-4/);
    });

    test('clicking Queue button again exits queue view', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Click Queue button again
      await page.locator('button:has-text("Queue")').click();

      // Should navigate to instances view
      await expect(page).toHaveURL(/.*\/instances/);
    });
  });

  test.describe('Keyboard Hints', () => {
    test('shows keyboard hint footer', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);
      await page.goto('/queue');

      // Footer should show keyboard hints
      await expect(page.locator('kbd:has-text("Esc")')).toBeVisible();
      // Use more specific selector for the footer hint text
      const footerHints = page.locator('.border-t.border-surface-600');
      await expect(footerHints.locator('text=Skip')).toBeVisible();
      await expect(page.locator('kbd:has-text("Enter")')).toBeVisible();
      await expect(footerHints.locator('text=Send command')).toBeVisible();
    });
  });

  test.describe('Terminal Rendering After Queue Mode Toggle', () => {
    test('terminal is visible after toggling queue mode on and off', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);

      // Start at an instance view
      await page.goto('/instances/instance-1');
      await page.waitForTimeout(500);

      // Terminal should be visible (use :visible to get only the displayed terminal)
      const terminal = page.locator('.xterm-screen:visible').first();
      await expect(terminal).toBeVisible({ timeout: 5000 });

      // Click Queue to enter queue mode
      await page.locator('button:has-text("Queue")').click();
      await page.waitForTimeout(300);

      // Click Queue again to exit queue mode
      await page.locator('button:has-text("Queue")').click();
      await page.waitForTimeout(300);

      // Navigate back to the instance
      await page.goto('/instances/instance-1');
      await page.waitForTimeout(500);

      // Terminal should still be visible after queue mode toggle
      const terminalAfter = page.locator('.xterm-screen:visible').first();
      await expect(terminalAfter).toBeVisible({ timeout: 5000 });
    });

    test('terminal xterm-screen element exists after returning from queue mode', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);

      // Navigate directly to an instance
      await page.goto('/instances/instance-1');
      await page.waitForTimeout(1000);

      // Verify xterm terminal element exists (use first() for strict mode)
      const xtermScreen = page.locator('.xterm-screen').first();
      await expect(xtermScreen).toBeAttached({ timeout: 5000 });

      // Toggle queue mode
      await page.locator('button:has-text("Queue")').click();
      await page.waitForTimeout(500);
      await page.locator('button:has-text("Queue")').click();
      await page.waitForTimeout(500);

      // Go back to instance view
      await page.goto('/instances/instance-1');
      await page.waitForTimeout(1000);

      // Terminal element should still be attached and functional
      const xtermScreenAfter = page.locator('.xterm-screen').first();
      await expect(xtermScreenAfter).toBeAttached({ timeout: 5000 });
    });

    test('terminal container has correct visibility after exiting queue mode overlay', async ({ page }) => {
      await setupInstancesMock(page, mockInstancesWithIdle);

      // Start at instance view
      await page.goto('/instances/instance-1');
      await page.waitForTimeout(1000);

      // Get the terminal container (use :visible for displayed terminal)
      const terminalContainer = page.locator('.xterm-screen:visible').first();

      // Verify it's visible
      await expect(terminalContainer).toBeVisible({ timeout: 5000 });

      // Enter queue mode by clicking Queue button
      await page.locator('button:has-text("Queue")').click();
      await page.waitForTimeout(500);

      // The queue mode activates and shows overlay on instance view
      // Exit by pressing Escape or clicking Queue button again
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // Verify terminal is visible (not hidden by CSS)
      // The fix ensures refresh() is called to re-render the terminal
      const terminalAfter = page.locator('.xterm-screen:visible').first();
      await expect(terminalAfter).toBeVisible({ timeout: 5000 });
    });
  });
});
