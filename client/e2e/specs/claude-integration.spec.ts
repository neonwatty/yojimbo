import { test, expect } from '../fixtures/test-fixtures';

/**
 * Real Claude Code Integration Tests
 *
 * These tests verify the full integration with Claude Code CLI:
 * 1. Start instance with terminal
 * 2. Run `claude` command
 * 3. Verify status changes via WebSocket
 *
 * Prerequisites:
 * - Claude Code CLI installed (`claude` command available)
 * - API key configured
 * - Hooks installed (`make hooks-install`)
 *
 * Run with: npm run test:e2e -- --grep "Claude Integration"
 */

const API_BASE = 'http://localhost:3456/api';

// Helper to get the status badge
const statusBadge = (page: any, status: string) =>
  page.locator('span.inline-flex').filter({ hasText: status });

// Skip these tests unless explicitly enabled
const describeOrSkip = process.env.TEST_CLAUDE_INTEGRATION
  ? test.describe
  : test.describe.skip;

describeOrSkip('Claude Integration', () => {
  test.setTimeout(120000); // 2 minute timeout for Claude operations

  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  test('claude command changes status to working', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view with terminal
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    await instancesPage.page.waitForTimeout(3000);

    // Should start as idle
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 10000 });

    // Focus terminal and run claude with a simple prompt
    const terminal = instancesPage.page.locator('.xterm-screen');
    await terminal.click();

    // Type claude command with a simple prompt that will trigger tool use
    await instancesPage.page.keyboard.type('claude -p "list files in current directory"');
    await instancesPage.page.keyboard.press('Enter');

    // Wait for Claude to start and status to change to working
    // This may take a few seconds as Claude initializes
    await expect(statusBadge(instancesPage.page, 'Working')).toBeVisible({ timeout: 30000 });

    // Wait for Claude to finish
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 60000 });
  });

  test('claude awaiting input shows awaiting status', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    await instancesPage.page.waitForTimeout(3000);

    const terminal = instancesPage.page.locator('.xterm-screen');
    await terminal.click();

    // Run claude in interactive mode (no -p flag)
    await instancesPage.page.keyboard.type('claude');
    await instancesPage.page.keyboard.press('Enter');

    // Should eventually show awaiting when Claude prompts for input
    await expect(statusBadge(instancesPage.page, 'Awaiting')).toBeVisible({ timeout: 30000 });

    // Type /exit to quit claude
    await instancesPage.page.keyboard.type('/exit');
    await instancesPage.page.keyboard.press('Enter');

    // Should go back to idle
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 30000 });
  });

  test('full claude workflow: idle -> working -> awaiting -> idle', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    await instancesPage.page.waitForTimeout(3000);

    // 1. Starts as idle
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 10000 });

    const terminal = instancesPage.page.locator('.xterm-screen');
    await terminal.click();

    // 2. Start claude
    await instancesPage.page.keyboard.type('claude');
    await instancesPage.page.keyboard.press('Enter');

    // 3. Wait for awaiting (Claude prompts for input)
    await expect(statusBadge(instancesPage.page, 'Awaiting')).toBeVisible({ timeout: 30000 });

    // 4. Give Claude a task
    await instancesPage.page.keyboard.type('echo hello');
    await instancesPage.page.keyboard.press('Enter');

    // 5. Should transition to working
    await expect(statusBadge(instancesPage.page, 'Working')).toBeVisible({ timeout: 30000 });

    // 6. Wait for it to finish and show awaiting again
    await expect(statusBadge(instancesPage.page, 'Awaiting')).toBeVisible({ timeout: 60000 });

    // 7. Exit claude
    await instancesPage.page.keyboard.type('/exit');
    await instancesPage.page.keyboard.press('Enter');

    // 8. Should go back to idle
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 30000 });
  });
});
