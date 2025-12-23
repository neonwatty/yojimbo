import { test, expect } from '../fixtures/test-fixtures';

test.describe('Navigation', () => {
  test('app loads at root path', async ({ basePage }) => {
    await basePage.goto('/');
    await expect(basePage.page).toHaveURL(/.*\//);
  });

  test('can navigate to instances page', async ({ basePage }) => {
    await basePage.goto('/');
    await basePage.page.goto('/instances');
    await expect(basePage.page).toHaveURL(/.*\/instances/);
  });

  test('can navigate to history page', async ({ basePage }) => {
    await basePage.goto('/');
    await basePage.page.goto('/history');
    await expect(basePage.page).toHaveURL(/.*\/history/);
  });
});

test.describe('Keyboard Shortcuts', () => {
  test('Cmd+, opens settings modal', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();
    await expect(basePage.page.locator('h2:has-text("Settings")')).toBeVisible();
  });

  test('Escape closes settings modal', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();
    await basePage.closeModalWithEscape();
    await expect(basePage.page.locator('h2:has-text("Settings")')).not.toBeVisible();
  });

  test('Cmd+/ opens shortcuts modal', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openShortcuts();
    await expect(basePage.page.locator('h2:has-text("Keyboard Shortcuts")')).toBeVisible();
  });

  test('Escape closes shortcuts modal', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openShortcuts();
    await basePage.closeModalWithEscape();
    await expect(basePage.page.locator('h2:has-text("Keyboard Shortcuts")')).not.toBeVisible();
  });
});
