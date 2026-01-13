import { test, expect } from '../fixtures/test-fixtures';

test.describe('App Branding', () => {
  test('shows Yojimbo in header', async ({ basePage }) => {
    await basePage.goto('/instances');
    await expect(basePage.page.locator('h1:has-text("Yojimbo")')).toBeVisible();
  });

  test('page title includes environment label and Yojimbo', async ({ basePage }) => {
    await basePage.goto('/instances');
    // Title format: [PROD] Yojimbo or [DEV] Yojimbo
    await expect(basePage.page).toHaveTitle(/\[(PROD|DEV|LOCAL)\] Yojimbo/);
  });
});

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

  test('Cmd+K opens command palette', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.page.keyboard.press('Meta+k');
    await expect(basePage.page.locator('input[placeholder="Search commands..."]')).toBeVisible();
  });

  test('Escape closes command palette', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.page.keyboard.press('Meta+k');
    await expect(basePage.page.locator('input[placeholder="Search commands..."]')).toBeVisible();
    await basePage.page.keyboard.press('Escape');
    await expect(basePage.page.locator('input[placeholder="Search commands..."]')).not.toBeVisible();
  });

  test('G H navigates to home', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.page.keyboard.press('g');
    await basePage.page.keyboard.press('h');
    await expect(basePage.page).toHaveURL(/.*\/$/);
  });

  test('G I navigates to instances', async ({ basePage }) => {
    await basePage.goto('/');
    await basePage.page.keyboard.press('g');
    await basePage.page.keyboard.press('i');
    await expect(basePage.page).toHaveURL(/.*\/instances/);
  });

  test('G S navigates to history', async ({ basePage }) => {
    await basePage.goto('/');
    await basePage.page.keyboard.press('g');
    await basePage.page.keyboard.press('s');
    await expect(basePage.page).toHaveURL(/.*\/history/);
  });

  test('Cmd+N opens new instance modal', async ({ basePage, apiClient }) => {
    await basePage.goto('/instances');
    await basePage.page.keyboard.press('Meta+n');

    // Modal should appear
    await expect(basePage.page.getByRole('heading', { name: 'New Session' })).toBeVisible({ timeout: 5000 });

    // Fill in name and submit
    await basePage.page.locator('input[placeholder="My Project"]').fill('keyboard-test');
    const modal = basePage.page.locator('.fixed.inset-0').filter({ has: basePage.page.getByRole('heading', { name: 'New Session' }) });
    await modal.getByRole('button', { name: 'Create Session' }).click();

    // Should navigate to a new instance page
    await basePage.page.waitForURL(/.*\/instances\/[a-f0-9-]+/);
    await expect(basePage.page).toHaveURL(/.*\/instances\/[a-f0-9-]+/);
  });
});

test.describe('Instance Keyboard Shortcuts', () => {
  test('Cmd+P toggles pin on current instance', async ({ basePage, apiClient }) => {
    // Create an instance first
    const instance = await apiClient.createInstance({ name: 'test-pin', workingDir: '~' });
    await basePage.goto(`/instances/${instance.id}`);

    // Should not be pinned initially (no "pinned" badge in header)
    await expect(basePage.page.locator('text=(1 pinned)')).not.toBeVisible();

    // Toggle pin
    await basePage.page.keyboard.press('Meta+p');
    await basePage.page.waitForTimeout(300);

    // Should now show pinned badge in header
    await expect(basePage.page.locator('text=(1 pinned)')).toBeVisible();
  });

  test('Cmd+1 switches to first instance', async ({ basePage, apiClient }) => {
    // Create two instances
    const instance1 = await apiClient.createInstance({ name: 'first', workingDir: '~' });
    const instance2 = await apiClient.createInstance({ name: 'second', workingDir: '~' });

    // Start on second instance
    await basePage.goto(`/instances/${instance2.id}`);

    // Press Cmd+1 to go to first instance
    await basePage.page.keyboard.press('Meta+1');
    await basePage.page.waitForURL(`**/instances/${instance1.id}`);
    await expect(basePage.page).toHaveURL(new RegExp(`/instances/${instance1.id}`));
  });
});
