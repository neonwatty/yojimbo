import { test, expect } from '../fixtures/test-fixtures';

test.describe('Session Persistence', () => {
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  test('preserves plans panel open state across refresh', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open plans panel
    await instancesPage.page.locator('button:has-text("Plans")').click();
    await expect(instancesPage.page.locator('button[title="New plan"]')).toBeVisible();

    // Reload the page
    await instancesPage.page.reload();
    await instancesPage.page.waitForLoadState('networkidle');

    // Plans panel should still be open after reload
    await expect(instancesPage.page.locator('button[title="New plan"]')).toBeVisible({ timeout: 5000 });
  });

  test('preserves terminal panel state across refresh', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Terminal should be visible by default
    const terminal = instancesPage.page.locator('.xterm');
    await expect(terminal).toBeVisible();

    // Click terminal button to toggle it off
    await instancesPage.page.locator('button:has-text("Terminal")').click();
    await instancesPage.page.waitForTimeout(300);

    // Terminal should be hidden
    await expect(terminal).not.toBeVisible();

    // Reload the page
    await instancesPage.page.reload();
    await instancesPage.page.waitForLoadState('networkidle');

    // Terminal should still be hidden after reload
    await expect(instancesPage.page.locator('.xterm')).not.toBeVisible({ timeout: 5000 });
  });

  test('modals do not persist across refresh', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open settings modal
    await instancesPage.page.keyboard.press('Meta+Comma');
    await expect(instancesPage.page.locator('h2:has-text("Settings")')).toBeVisible();

    // Reload the page
    await instancesPage.page.reload();
    await instancesPage.page.waitForLoadState('networkidle');

    // Settings modal should NOT be visible after reload (modals don't persist)
    await expect(instancesPage.page.locator('h2:has-text("Settings")')).not.toBeVisible();
  });
});
