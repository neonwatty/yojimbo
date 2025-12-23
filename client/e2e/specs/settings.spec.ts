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
});
