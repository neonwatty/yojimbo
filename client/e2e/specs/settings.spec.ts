import { test, expect } from '../fixtures/test-fixtures';

test.describe('Settings Modal', () => {
  test('shows theme options', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check theme buttons are visible
    await expect(basePage.page.locator('button:has-text("light")')).toBeVisible();
    await expect(basePage.page.locator('button:has-text("dark")')).toBeVisible();
    await expect(basePage.page.locator('button:has-text("system")')).toBeVisible();
  });

  test('can change theme to light', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Click light theme button
    await basePage.page.locator('button:has-text("light")').click();

    // Verify the light button is selected (has active class)
    const lightButton = basePage.page.locator('button:has-text("light")');
    await expect(lightButton).toHaveClass(/bg-surface-500/);
  });

  test('can change theme to dark', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // First switch to light
    await basePage.page.locator('button:has-text("light")').click();
    await basePage.page.waitForTimeout(200);

    // Then switch to dark
    await basePage.page.locator('button:has-text("dark")').click();

    // Verify the dark button is selected
    const darkButton = basePage.page.locator('button:has-text("dark")');
    await expect(darkButton).toHaveClass(/bg-surface-500/);
  });

  test('shows terminal font size selector', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check font size select is visible
    const fontSizeSelect = basePage.page.locator('select').first();
    await expect(fontSizeSelect).toBeVisible();
  });

  test('shows terminal font family selector', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check font family select is visible
    const fontFamilySelect = basePage.page.locator('select').nth(1);
    await expect(fontFamilySelect).toBeVisible();

    // Verify it has font options
    await expect(fontFamilySelect.locator('option:has-text("JetBrains Mono")')).toBeAttached();
  });

  test('clicking backdrop closes modal', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Click the backdrop (fixed overlay)
    await basePage.page.locator('.fixed.inset-0').first().click({ position: { x: 10, y: 10 } });

    // Modal should be closed
    await expect(basePage.page.locator('h2:has-text("Settings")')).not.toBeVisible();
  });

  test('shows version number in footer', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check version is displayed (format: v0.x.x)
    await expect(basePage.page.locator('text=/v\\d+\\.\\d+\\.\\d+/')).toBeVisible();
  });

  test('shows danger zone with database reset option', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check danger zone section exists
    await expect(basePage.page.locator('text=Danger Zone')).toBeVisible();

    // Check reset button exists but is disabled
    const resetButton = basePage.page.locator('button:has-text("Reset")');
    await expect(resetButton).toBeVisible();
    await expect(resetButton).toBeDisabled();
  });

  test('reset button is disabled until RESET is typed', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    const resetInput = basePage.page.locator('input[placeholder*="RESET"]');
    const resetButton = basePage.page.locator('button:has-text("Reset")');

    // Button should be disabled initially
    await expect(resetButton).toBeDisabled();

    // Type partial text - button still disabled
    await resetInput.fill('RES');
    await expect(resetButton).toBeDisabled();

    // Type full RESET - button becomes enabled
    await resetInput.fill('RESET');
    await expect(resetButton).toBeEnabled();
  });

  test('database reset API clears all instances', async ({ apiClient }) => {
    // Create an instance first
    await apiClient.createInstance({ name: 'test-reset', workingDir: '~' });

    // Verify instance exists
    const instancesBefore = await apiClient.listInstances();
    expect(instancesBefore.length).toBeGreaterThan(0);

    // Perform reset via API
    const result = await apiClient.resetDatabase();
    expect(result.reset).toBe(true);

    // Verify instances are cleared
    const instancesAfter = await apiClient.listInstances();
    expect(instancesAfter.length).toBe(0);
  });
});
