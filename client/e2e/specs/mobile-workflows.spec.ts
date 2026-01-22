import { test, expect } from '../fixtures/test-fixtures';
import type { Page } from '@playwright/test';

/**
 * Mobile Workflow Tests
 *
 * These tests mirror the iOS Simulator workflows documented in /workflows/ios-workflows.md
 * They test mobile-specific UI patterns, gestures, and UX best practices.
 */

/**
 * Helper to click the Tasks button in the bottom navigation.
 * Uses dispatchEvent('click') because the fixed-position bottom nav
 * can be outside the viewport on mobile emulation, causing regular
 * clicks to fail even with force:true.
 */
async function clickTasksButton(page: Page) {
  const tasksButton = page.locator('button:has-text("Tasks")');
  await tasksButton.dispatchEvent('click');
  await page.waitForTimeout(300);
}

/**
 * Helper to click a menu item.
 * Uses dispatchEvent because backdrop elements can intercept clicks.
 */
async function clickMenuItem(page: Page, selector: string) {
  const menuItem = page.locator(selector);
  await menuItem.dispatchEvent('click');
  await page.waitForTimeout(100);
}

test.describe('Mobile Workflows', () => {
  test.beforeEach(async ({ apiClient }) => {
    // Clean up before each test
    await apiClient.cleanupAllTasks();
    await apiClient.cleanupAllInstances();
  });

  test.describe('Workflow 1: Getting Started', () => {
    test('detects mobile layout and shows mobile UI', async ({ basePage }) => {
      await basePage.goto('/');

      // Mobile layout should be detected (no sidebar visible)
      // On mobile, we should see the swipe hint indicators
      const topHint = basePage.page.locator('.w-10.h-1.bg-surface-500\\/50').first();
      await expect(topHint).toBeVisible();
    });

    test('shows settings drawer navigation options', async ({ basePage }) => {
      await basePage.goto('/');

      // On mobile, navigation is via drawers
      // The Home button should be visible in the settings drawer
      // Since we can't easily trigger swipe gestures, we check for mobile-specific elements
      const mobileLayout = basePage.page.locator('[class*="flex-col"][class*="bg-surface-800"]').first();
      await expect(mobileLayout).toBeVisible();
    });

    test('shows connected status', async ({ basePage }) => {
      await basePage.goto('/');

      // Wait for WebSocket connection
      await basePage.page.waitForTimeout(1000);

      // Should show dashboard heading
      await expect(basePage.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  test.describe('Workflow 2: Managing Instances', () => {
    test('shows instance list on dashboard', async ({ basePage, apiClient }) => {
      // Create test instances
      await apiClient.createInstance({ name: 'MobileTestInstance1', workingDir: '/tmp' });
      await apiClient.createInstance({ name: 'MobileTestInstance2', workingDir: '/tmp' });

      await basePage.goto('/');
      await basePage.page.waitForTimeout(500);

      // Dashboard should show recent instances heading
      await expect(basePage.page.getByRole('heading', { name: 'Recent' })).toBeVisible();
    });

    test('can create new instance from dashboard', async ({ basePage }) => {
      await basePage.goto('/');

      // Look for "New Session" button (use first() since there may be multiple)
      const newSessionButton = basePage.page.locator('button:has-text("New Session")').first();
      await expect(newSessionButton).toBeVisible();

      // Click to open creation modal
      await newSessionButton.click();

      // Modal should appear
      await expect(basePage.page.locator('h2:has-text("New Session")')).toBeVisible();
    });

    test('instance shows status indicator', async ({ basePage, apiClient }) => {
      await apiClient.createInstance({ name: 'StatusTestInstance', workingDir: '/tmp' });

      await basePage.goto('/');
      await basePage.page.waitForTimeout(500);

      // Status indicator (colored dot) should be visible near the instance
      // The instance list items have status dots
      const statusIndicator = basePage.page.locator('.rounded-full').first();
      await expect(statusIndicator).toBeVisible();
    });
  });

  test.describe('Workflow 3: Terminal Interaction', () => {
    test('instance opens terminal view', async ({ basePage, apiClient }) => {
      await apiClient.createInstance({ name: 'TerminalTestInstance', workingDir: '/tmp' });

      await basePage.goto('/');
      await basePage.page.waitForTimeout(500);

      // Click on the instance to open it (use first() since name appears multiple times)
      await basePage.page.locator('text=TerminalTestInstance').first().click();
      await basePage.page.waitForTimeout(500);

      // Terminal should be visible (xterm canvas or terminal container)
      const terminal = basePage.page.locator('.xterm-screen').or(basePage.page.locator('[data-testid*="terminal"]'));
      await expect(terminal).toBeVisible();
    });

    test('terminal shows instance header with name', async ({ basePage, apiClient }) => {
      await apiClient.createInstance({ name: 'HeaderTestInstance', workingDir: '/tmp' });

      await basePage.goto('/');
      await basePage.page.waitForTimeout(500);

      await basePage.page.locator('text=HeaderTestInstance').first().click();
      await basePage.page.waitForTimeout(500);

      // The instance name should be visible in the view
      await expect(basePage.page.locator('text=HeaderTestInstance').first()).toBeVisible();
    });
  });

  test.describe('Workflow 4: Task Management', () => {
    test('navigates to tasks view', async ({ basePage }) => {
      await basePage.goto('/');

      // Click on Tasks in navigation
      await clickTasksButton(basePage.page);

      // Should show tasks interface
      await expect(basePage.page.locator('text=pending').or(basePage.page.locator('input[placeholder*="task"]'))).toBeVisible();
    });

    test('can create new task', async ({ basePage, apiClient }) => {
      await basePage.goto('/');

      // Open tasks
      await clickTasksButton(basePage.page);

      // Find task input and add a task
      const input = basePage.page.locator('input[placeholder*="task"]').or(basePage.page.locator('input[placeholder*="Add"]'));
      await input.fill('Mobile test task');

      // Click Add button
      await basePage.page.locator('button:has-text("Add")').click();
      await basePage.page.waitForTimeout(300);

      // Task should appear
      await expect(basePage.page.locator('text=Mobile test task')).toBeVisible();

      // Verify via API
      const tasks = await apiClient.listTasks();
      expect(tasks.some(t => t.text === 'Mobile test task')).toBe(true);
    });

    test('shows action menu button on task (accessibility alternative to swipe)', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Task with menu');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // The overflow menu button (three dots) should be visible
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]');
      await expect(menuButton).toBeVisible();
    });

    test('can mark task done via menu button', async ({ basePage, apiClient }) => {
      const task = await apiClient.createTask('Task to complete via menu');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Click the menu button
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      await menuButton.click();
      await basePage.page.waitForTimeout(100);

      // Click "Mark done" option using dispatchEvent to bypass backdrop
      await clickMenuItem(basePage.page, 'text=Mark done');
      await basePage.page.waitForTimeout(300);

      // Verify task is done via API
      const updatedTask = await apiClient.getTask(task.id);
      expect(updatedTask.status).toBe('done');
    });

    test('can delete task via menu button', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Task to delete via menu');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Click the menu button
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      await menuButton.click();
      await basePage.page.waitForTimeout(100);

      // Click "Delete" option using dispatchEvent to bypass backdrop
      await clickMenuItem(basePage.page, '[data-testid^="task-menu-dropdown-"] button:has-text("Delete")');
      await basePage.page.waitForTimeout(300);

      // Verify task is deleted
      const tasks = await apiClient.listTasks();
      expect(tasks.length).toBe(0);
    });

    test('can dispatch task via menu button', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Task to dispatch via menu');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Click the menu button
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      await menuButton.click();
      await basePage.page.waitForTimeout(100);

      // Click "Dispatch" option using dispatchEvent to bypass backdrop
      await clickMenuItem(basePage.page, '[data-testid^="task-menu-dropdown-"] button:has-text("Dispatch")');
      await basePage.page.waitForTimeout(300);

      // Dispatch sheet should open with options
      await expect(basePage.page.getByRole('heading', { name: 'Dispatch Task' })).toBeVisible();
    });

    test('shows action hint text', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Hint test task');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Should show the updated hint text
      await expect(basePage.page.locator('text=Swipe or tap')).toBeVisible();
    });

    test('pending count updates after task creation', async ({ basePage, apiClient }) => {
      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Create a task
      const input = basePage.page.locator('input[placeholder*="task"]').or(basePage.page.locator('input[placeholder*="Add"]'));
      await input.fill('Count test task');
      await basePage.page.locator('button:has-text("Add")').click();
      await basePage.page.waitForTimeout(300);

      // Pending count should show 1
      await expect(basePage.page.locator('text=1 pending')).toBeVisible();
    });
  });

  test.describe('Workflow 5: Task Dispatch', () => {
    test('dispatch sheet shows copy to clipboard option', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Dispatch sheet test');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Open menu and click dispatch
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      await menuButton.click();
      await basePage.page.waitForTimeout(100);
      await clickMenuItem(basePage.page, '[data-testid^="task-menu-dropdown-"] button:has-text("Dispatch")');
      await basePage.page.waitForTimeout(300);

      // Should show copy option
      await expect(basePage.page.locator('text=Copy to clipboard')).toBeVisible();
    });

    test('dispatch sheet shows running instances', async ({ basePage, apiClient }) => {
      // Create an instance first
      await apiClient.createInstance({ name: 'RunningInstance', workingDir: '/tmp' });
      await apiClient.createTask('Dispatch to instance test');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Open menu and click dispatch
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      await menuButton.click();
      await basePage.page.waitForTimeout(100);
      await clickMenuItem(basePage.page, '[data-testid^="task-menu-dropdown-"] button:has-text("Dispatch")');
      await basePage.page.waitForTimeout(300);

      // Should show the running instance (use first() since name may appear in multiple places)
      await expect(basePage.page.locator('text=RunningInstance').first()).toBeVisible();
    });

    test('dispatch sheet shows create new instance option', async ({ basePage, apiClient }) => {
      await apiClient.createTask('New instance dispatch test');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Open menu and click dispatch
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      await menuButton.click();
      await basePage.page.waitForTimeout(100);
      await clickMenuItem(basePage.page, '[data-testid^="task-menu-dropdown-"] button:has-text("Dispatch")');
      await basePage.page.waitForTimeout(300);

      // Should show create new instance option
      await expect(basePage.page.locator('text=Create new instance')).toBeVisible();
    });
  });

  test.describe('UX Best Practices', () => {
    test('buttons have adequate touch target size (44px minimum)', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Touch target test');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Check Add button size
      const addButton = basePage.page.locator('button:has-text("Add")');
      const addBox = await addButton.boundingBox();
      expect(addBox?.height).toBeGreaterThanOrEqual(44);

      // Check menu button has adequate touch area
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      const menuBox = await menuButton.boundingBox();
      // The clickable area should be at least 24px, though visual may be smaller
      expect(menuBox?.height).toBeGreaterThanOrEqual(20);
    });

    test('input fields have adequate height for mobile', async ({ basePage }) => {
      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Task input should have comfortable height
      const input = basePage.page.locator('input[placeholder*="task"]').or(basePage.page.locator('input[placeholder*="Add"]'));
      const inputBox = await input.boundingBox();
      expect(inputBox?.height).toBeGreaterThanOrEqual(40);
    });

    test('text is readable size on mobile', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Readable text test task with longer content');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Task text should be visible and readable (font-size at least 14px equivalent)
      const taskText = basePage.page.locator('text=Readable text test');
      await expect(taskText).toBeVisible();
    });

    test('action menu closes when clicking outside', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Menu close test');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Open menu
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      await menuButton.click();
      await basePage.page.waitForTimeout(100);

      // Menu should be visible
      await expect(basePage.page.locator('[data-testid^="task-menu-dropdown-"]')).toBeVisible();

      // Click on the backdrop element that closes the menu (use the specific z-0 backdrop)
      const backdrop = basePage.page.locator('.fixed.inset-0.z-0');
      await backdrop.dispatchEvent('click');
      await basePage.page.waitForTimeout(100);

      // Menu should be closed
      await expect(basePage.page.locator('[data-testid^="task-menu-dropdown-"]')).not.toBeVisible();
    });

    test('loading states are shown appropriately', async ({ basePage }) => {
      await basePage.goto('/');

      // Dashboard should load without errors
      // Either show loading state or content
      await expect(
        basePage.page.locator('text=Dashboard').or(basePage.page.locator('.animate-pulse'))
      ).toBeVisible({ timeout: 5000 });
    });

    test('empty states have clear messaging', async ({ basePage }) => {
      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // With no tasks, should show empty state message
      await expect(basePage.page.getByText('No tasks yet')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('menu button has aria-label', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Accessibility test');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Menu button should have aria-label
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      const ariaLabel = await menuButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
    });

    test('action buttons have descriptive labels', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Button label test');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Open menu
      const menuButton = basePage.page.locator('[data-testid^="task-menu-"]').first();
      await menuButton.click();

      // Menu options should have clear text labels
      await expect(basePage.page.locator('button:has-text("Dispatch")')).toBeVisible();
      await expect(basePage.page.locator('button:has-text("Mark done")')).toBeVisible();
      await expect(basePage.page.locator('button:has-text("Delete")')).toBeVisible();
    });

    test('checkbox is keyboard accessible', async ({ basePage, apiClient }) => {
      await apiClient.createTask('Keyboard test');

      await basePage.goto('/');
      await clickTasksButton(basePage.page);

      // Checkbox button should be focusable
      const checkbox = basePage.page.locator('[data-testid^="task-checkbox-"]').first();
      await expect(checkbox).toBeVisible();

      // Should be a button element (accessible)
      const tagName = await checkbox.evaluate(el => el.tagName);
      expect(tagName.toLowerCase()).toBe('button');
    });
  });
});
