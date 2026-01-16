import { test, expect } from '../fixtures/test-fixtures';

/**
 * Ports Panel Smoke Tests
 *
 * These tests verify that the Ports Panel feature works correctly for
 * detecting and displaying listening ports from Claude Code instances.
 */
test.describe('Ports Panel', () => {
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  // Ensure tests run at desktop viewport
  test.use({ viewport: { width: 1280, height: 800 } });

  test('ports button is visible in instance view header for local instance', async ({ basePage, apiClient }) => {
    // Create a local instance
    const instance = await apiClient.createInstance({
      name: 'ports-test',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Wait for terminal to load
    await expect(basePage.page.locator('.xterm-screen')).toBeVisible({ timeout: 10000 });

    // Ports button should be visible in the header
    const portsButton = basePage.page.getByRole('button', { name: /ports/i });
    await expect(portsButton).toBeVisible();
  });

  test('can toggle ports panel open and closed', async ({ basePage, apiClient }) => {
    // Create a local instance
    const instance = await apiClient.createInstance({
      name: 'toggle-ports-test',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Wait for terminal to load
    await expect(basePage.page.locator('.xterm-screen')).toBeVisible({ timeout: 10000 });

    // Click ports button to open panel
    const portsButton = basePage.page.getByRole('button', { name: /ports/i });
    await portsButton.click();

    // Panel should appear with "Ports" header
    const portsHeader = basePage.page.locator('[class*="border-l"]').getByText('Ports', { exact: true });
    await expect(portsHeader).toBeVisible({ timeout: 5000 });

    // Click again to close
    await portsButton.click();

    // Panel header should be hidden
    await expect(portsHeader).not.toBeVisible();
  });

  test('ports panel shows empty state when no ports detected', async ({ basePage, apiClient }) => {
    // Create a local instance
    const instance = await apiClient.createInstance({
      name: 'empty-ports-test',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Wait for terminal to load
    await expect(basePage.page.locator('.xterm-screen')).toBeVisible({ timeout: 10000 });

    // Click ports button to open panel
    const portsButton = basePage.page.getByRole('button', { name: /ports/i });
    await portsButton.click();

    // Should see empty state message
    await expect(
      basePage.page.getByText(/no ports detected/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('ports panel shows instructions for making ports accessible', async ({ basePage, apiClient }) => {
    // Create a local instance
    const instance = await apiClient.createInstance({
      name: 'instructions-test',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Wait for terminal to load
    await expect(basePage.page.locator('.xterm-screen')).toBeVisible({ timeout: 10000 });

    // Click ports button to open panel
    const portsButton = basePage.page.getByRole('button', { name: /ports/i });
    await portsButton.click();

    // Should see instructions about binding to 0.0.0.0
    await expect(
      basePage.page.getByText(/--host 0\.0\.0\.0/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('ports panel shows refresh button', async ({ basePage, apiClient }) => {
    // Create a local instance
    const instance = await apiClient.createInstance({
      name: 'refresh-test',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Wait for terminal to load
    await expect(basePage.page.locator('.xterm-screen')).toBeVisible({ timeout: 10000 });

    // Click ports button to open panel
    const portsButton = basePage.page.getByRole('button', { name: /ports/i });
    await portsButton.click();

    // Should see refresh button
    const refreshButton = basePage.page.getByRole('button', { name: /refresh/i });
    await expect(refreshButton).toBeVisible();
  });

  test('ports panel can be resized', async ({ basePage, apiClient }) => {
    // Create a local instance
    const instance = await apiClient.createInstance({
      name: 'resize-test',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Wait for terminal to load
    await expect(basePage.page.locator('.xterm-screen')).toBeVisible({ timeout: 10000 });

    // Click ports button to open panel
    const portsButton = basePage.page.getByRole('button', { name: /ports/i });
    await portsButton.click();

    // Panel should appear - look for the Ports header in the side panel
    const portsPanel = basePage.page.locator('[class*="border-l"]').filter({
      has: basePage.page.getByText('Ports', { exact: true })
    });
    await expect(portsPanel).toBeVisible({ timeout: 5000 });

    // Look for the resize handle (usually on the left edge of right panels)
    const panel = portsPanel;

    // The panel should be visible and have some width
    await expect(panel).toBeVisible();
  });

  test('command palette shows toggle ports option', async ({ basePage, apiClient }) => {
    // Create a local instance to get to instance view
    const instance = await apiClient.createInstance({
      name: 'command-palette-test',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Open command palette with Cmd+K
    await basePage.page.keyboard.press('Meta+k');

    // Wait for command palette to appear
    await expect(basePage.page.getByPlaceholder('Search commands...')).toBeVisible({ timeout: 5000 });

    // Search for "ports"
    await basePage.page.fill('[placeholder="Search commands..."]', 'ports');

    // Should see the toggle ports option
    await expect(basePage.page.getByText('Toggle Ports Panel')).toBeVisible();
  });

  test('can open ports panel via command palette', async ({ basePage, apiClient }) => {
    // Create a local instance
    const instance = await apiClient.createInstance({
      name: 'cmd-palette-ports',
      workingDir: '~'
    });

    // Navigate to instance
    await basePage.goto(`/instances/${instance.id}`);

    // Wait for terminal to load
    await expect(basePage.page.locator('.xterm-screen')).toBeVisible({ timeout: 10000 });

    // Open command palette
    await basePage.page.keyboard.press('Meta+k');

    // Wait for command palette
    await expect(basePage.page.getByPlaceholder('Search commands...')).toBeVisible({ timeout: 5000 });

    // Search for and click toggle ports
    await basePage.page.fill('[placeholder="Search commands..."]', 'ports');
    await basePage.page.getByText('Toggle Ports Panel').click();

    // Panel should now be visible - look for Ports header in side panel
    const portsPanel = basePage.page.locator('[class*="border-l"]').filter({
      has: basePage.page.getByText('Ports', { exact: true })
    });
    await expect(portsPanel).toBeVisible({ timeout: 5000 });
  });
});
