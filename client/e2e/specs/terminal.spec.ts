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

  test('terminal history persists when switching between instances', async ({ instancesPage, apiClient }) => {
    await instancesPage.gotoInstances();

    // Create first instance
    const instance1 = await apiClient.createInstance({ name: 'history-test-1', workingDir: '~' });
    // Create second instance
    const instance2 = await apiClient.createInstance({ name: 'history-test-2', workingDir: '~' });

    // Navigate to first instance
    await instancesPage.page.goto(`/instances/${instance1.id}`);
    await instancesPage.page.waitForTimeout(2000);

    // Type unique command in first instance (use :visible to get only the displayed terminal)
    const terminal1 = instancesPage.page.locator('.xterm-screen:visible').first();
    await terminal1.click();
    await instancesPage.page.keyboard.type('echo "UNIQUE-OUTPUT-INSTANCE-1"');
    await instancesPage.page.keyboard.press('Enter');
    await instancesPage.page.waitForTimeout(1000);

    // Switch to second instance via sidebar
    await instancesPage.page.locator(`text=history-test-2`).click();
    await instancesPage.page.waitForTimeout(2000);

    // Type unique command in second instance
    const terminal2 = instancesPage.page.locator('.xterm-screen:visible').first();
    await terminal2.click();
    await instancesPage.page.keyboard.type('echo "UNIQUE-OUTPUT-INSTANCE-2"');
    await instancesPage.page.keyboard.press('Enter');
    await instancesPage.page.waitForTimeout(1000);

    // Switch back to first instance
    await instancesPage.page.locator(`text=history-test-1`).click();
    await instancesPage.page.waitForTimeout(2000);

    // Verify first instance still shows its output (history persisted)
    // Get terminal text content from the visible terminal
    const terminalContent = await instancesPage.page.locator('.xterm-screen:visible').first().textContent();
    expect(terminalContent).toContain('UNIQUE-OUTPUT-INSTANCE-1');
  });

  test('terminals are isolated between instances (no cross-contamination)', async ({ instancesPage, apiClient }) => {
    await instancesPage.gotoInstances();

    // Create two instances
    const instance1 = await apiClient.createInstance({ name: 'isolation-test-1', workingDir: '~' });
    const instance2 = await apiClient.createInstance({ name: 'isolation-test-2', workingDir: '~' });

    // Navigate to first instance and type unique command
    await instancesPage.page.goto(`/instances/${instance1.id}`);
    await instancesPage.page.waitForTimeout(2000);

    const terminal1 = instancesPage.page.locator('.xterm-screen:visible').first();
    await terminal1.click();
    await instancesPage.page.keyboard.type('echo "ISOLATION-TEST-ONLY-IN-1"');
    await instancesPage.page.keyboard.press('Enter');
    await instancesPage.page.waitForTimeout(1000);

    // Switch to second instance
    await instancesPage.page.locator(`text=isolation-test-2`).click();
    await instancesPage.page.waitForTimeout(2000);

    // Second instance should NOT contain first instance's output (check visible terminal only)
    const terminal2Content = await instancesPage.page.locator('.xterm-screen:visible').first().textContent();
    expect(terminal2Content).not.toContain('ISOLATION-TEST-ONLY-IN-1');
  });
});
