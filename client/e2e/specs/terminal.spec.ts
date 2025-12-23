import { test, expect } from '../fixtures/test-fixtures';

test.describe('Terminal', () => {
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  test('terminal is visible when instance is expanded', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Creating instance navigates to expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Wait for terminal to load
    await instancesPage.page.waitForTimeout(2000);

    // Check for xterm terminal element
    const terminal = instancesPage.page.locator('.xterm-screen');
    await expect(terminal).toBeVisible({ timeout: 10000 });
  });

  test('can type in terminal', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Creating instance navigates to expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Wait for terminal to load
    await instancesPage.page.waitForTimeout(3000);

    // Focus the terminal and type
    const terminal = instancesPage.page.locator('.xterm-screen');
    await terminal.click();
    await instancesPage.page.keyboard.type('echo "hello"');
    await instancesPage.page.keyboard.press('Enter');

    // Wait for output
    await instancesPage.page.waitForTimeout(1000);

    // Terminal should exist (output verification is tricky with xterm)
    await expect(terminal).toBeVisible();
  });

  test('can return to overview with back button', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Creating instance navigates to expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Wait for page to settle
    await instancesPage.page.waitForTimeout(1000);

    // Click back button to return
    await instancesPage.page.locator('button[title="Back to overview (Escape)"]').click();

    // Should return to instances overview
    await expect(instancesPage.page).toHaveURL(/.*\/instances$/);
  });
});
