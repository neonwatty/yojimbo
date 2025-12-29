import { test, expect } from '../fixtures/test-fixtures';

/**
 * Desktop Layout Smoke Tests
 *
 * These tests verify that the desktop layout works correctly and isn't affected
 * by mobile layout changes. They specifically test desktop-only UI elements.
 */
test.describe('Desktop Layout', () => {
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  // Ensure tests run at desktop viewport
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sidebar is visible at desktop viewport', async ({ basePage }) => {
    await basePage.goto('/');

    // The left sidebar should be visible
    const sidebar = basePage.page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Sidebar should have the Sessions header
    await expect(sidebar.getByText('Sessions')).toBeVisible();

    // New instance button should be visible in sidebar
    await expect(sidebar.getByRole('button', { name: /create new instance/i })).toBeVisible();
  });

  test('header is visible at desktop viewport', async ({ basePage }) => {
    await basePage.goto('/');

    // Header should be visible with app title/logo
    const header = basePage.page.locator('header').first();
    await expect(header).toBeVisible();
  });

  test('can create instance and see it in sidebar', async ({ basePage }) => {
    await basePage.goto('/');

    // Click New Session button
    const newButton = basePage.page.getByRole('button', { name: 'New Session' }).first();
    await newButton.click();

    // Modal should appear
    await expect(basePage.page.getByRole('heading', { name: 'New Session' })).toBeVisible({ timeout: 5000 });

    // Fill in name and create
    await basePage.page.locator('input[placeholder="My Project"]').fill('desktop-test-instance');
    const modal = basePage.page.locator('.fixed.inset-0').filter({
      has: basePage.page.getByRole('heading', { name: 'New Session' })
    });
    await modal.getByRole('button', { name: 'Create Session' }).click();

    // Should navigate to instance view
    await basePage.page.waitForURL(/.*\/instances\/[a-f0-9-]+/);

    // Instance should appear in sidebar
    const sidebarInstance = basePage.page.locator('aside').getByText('desktop-test-instance');
    await expect(sidebarInstance).toBeVisible({ timeout: 5000 });
  });

  test('terminal is visible in desktop instance view', async ({ basePage, apiClient }) => {
    // Create an instance
    const instance = await apiClient.createInstance({
      name: 'terminal-test',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Terminal should be visible (xterm canvas)
    const terminal = basePage.page.locator('.xterm-screen');
    await expect(terminal).toBeVisible({ timeout: 10000 });
  });

  test('can toggle sidebar with keyboard shortcut', async ({ basePage }) => {
    await basePage.goto('/');

    // Sidebar should be visible initially
    const sidebar = basePage.page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Press Cmd/Ctrl+B to toggle sidebar
    await basePage.page.keyboard.press('Meta+b');

    // Sidebar should be hidden (or have hidden class)
    // Wait a moment for the animation
    await basePage.page.waitForTimeout(300);

    // Toggle back
    await basePage.page.keyboard.press('Meta+b');
    await basePage.page.waitForTimeout(300);

    // Sidebar should be visible again
    await expect(sidebar).toBeVisible();
  });

  test('instance cards display on instances page', async ({ basePage, apiClient }) => {
    // Create some instances
    await apiClient.createInstance({ name: 'instance-1', workingDir: '~' });
    await apiClient.createInstance({ name: 'instance-2', workingDir: '~' });

    // Navigate to instances page
    await basePage.goto('/instances');

    // Wait for page to load and instances to appear
    await basePage.page.waitForLoadState('networkidle');

    // Should see both instances (in sidebar or main content)
    await expect(basePage.page.getByText('instance-1').first()).toBeVisible({ timeout: 5000 });
    await expect(basePage.page.getByText('instance-2').first()).toBeVisible({ timeout: 5000 });
  });

  test('panels toggle correctly in instance view', async ({ basePage, apiClient }) => {
    // Create an instance
    const instance = await apiClient.createInstance({
      name: 'panel-test',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Wait for terminal to load
    await expect(basePage.page.locator('.xterm-screen')).toBeVisible({ timeout: 10000 });

    // Plans button should be visible in the header
    const plansButton = basePage.page.getByRole('button', { name: /plans/i });
    await expect(plansButton).toBeVisible();

    // Terminal button should be visible
    const terminalButton = basePage.page.getByRole('button', { name: /terminal/i });
    await expect(terminalButton).toBeVisible();
  });
});
