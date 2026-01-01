import { test, expect } from '../fixtures/test-fixtures';

/**
 * Keychain Unlock Feature Tests
 *
 * The keychain unlock button only appears for remote SSH instances.
 * Since E2E tests cannot easily create real SSH connections, these tests
 * verify that:
 * 1. The feature doesn't break existing functionality
 * 2. The button correctly does NOT appear for local instances
 */

test.describe('Keychain Unlock Feature', () => {
  test('instances page loads correctly with keychain feature', async ({ page }) => {
    await page.goto('/instances');
    await page.waitForLoadState('networkidle');

    // Verify the page loads and shows expected UI
    await expect(page.locator('body')).toBeVisible();

    // The keychain modal component should be part of the page (even if hidden)
    // Verify no JavaScript errors occurred during load
    const hasErrors = await page.evaluate(() => {
      return (window as unknown as { __playwrightErrors?: string[] }).__playwrightErrors?.length || 0;
    });
    expect(hasErrors).toBe(0);
  });

  test('no keychain button on instances overview', async ({ page }) => {
    await page.goto('/instances');
    await page.waitForLoadState('networkidle');

    // On the instances overview (before expanding an instance),
    // the keychain button should not be visible
    const keychainButton = page.getByRole('button', { name: 'Keychain' });
    await expect(keychainButton).not.toBeVisible();
  });

  test('page navigation works correctly', async ({ page }) => {
    // Verify that adding the keychain feature doesn't break navigation
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    await page.goto('/instances');
    await expect(page.locator('body')).toBeVisible();
  });
});
