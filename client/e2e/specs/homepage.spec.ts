import { test, expect } from '../fixtures/test-fixtures';

test.describe('HomePage', () => {
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  test('can create new instance from HomePage button', async ({ basePage, apiClient }) => {
    // Navigate to home page
    await basePage.goto('/');

    // Click the first "New Session" button (in the main content area)
    const newInstanceButton = basePage.page.getByRole('button', { name: 'New Session' }).first();
    await expect(newInstanceButton).toBeVisible();
    await newInstanceButton.click();

    // Modal should appear
    await expect(basePage.page.getByRole('heading', { name: 'New Session' })).toBeVisible({ timeout: 5000 });

    // Fill in name and submit
    await basePage.page.locator('input[placeholder="My Project"]').fill('test-instance');
    const modal = basePage.page.locator('.fixed.inset-0').filter({ has: basePage.page.getByRole('heading', { name: 'New Session' }) });
    await modal.getByRole('button', { name: 'Create Session' }).click();

    // Should navigate to the new instance's expanded view
    await basePage.page.waitForURL(/.*\/instances\/[a-f0-9-]+/);
    await expect(basePage.page).toHaveURL(/.*\/instances\/[a-f0-9-]+/);

    // Terminal should be visible (instance was created and PTY spawned)
    const terminal = basePage.page.locator('.xterm-screen');
    await expect(terminal).toBeVisible({ timeout: 10000 });
  });

  test('new instance appears in sidebar after creation from HomePage', async ({ basePage }) => {
    // Navigate to home page
    await basePage.goto('/');

    // Click the first "New Session" button (in the main content area)
    const newInstanceButton = basePage.page.getByRole('button', { name: 'New Session' }).first();
    await newInstanceButton.click();

    // Modal should appear - fill in name and submit
    await expect(basePage.page.getByRole('heading', { name: 'New Session' })).toBeVisible({ timeout: 5000 });
    await basePage.page.locator('input[placeholder="My Project"]').fill(`instance-${Date.now()}`);
    const modal = basePage.page.locator('.fixed.inset-0').filter({ has: basePage.page.getByRole('heading', { name: 'New Session' }) });
    await modal.getByRole('button', { name: 'Create Session' }).click();

    // Wait for navigation to instance
    await basePage.page.waitForURL(/.*\/instances\/[a-f0-9-]+/);

    // The new instance should appear in the sidebar
    const sidebarInstance = basePage.page.locator('.group').filter({ hasText: 'instance-' }).first();
    await expect(sidebarInstance).toBeVisible({ timeout: 5000 });
  });

  test('displays stats cards on HomePage', async ({ basePage, apiClient }) => {
    // Create a test instance first
    await apiClient.createInstance({ name: 'stats-test', workingDir: '~' });

    // Navigate to home page
    await basePage.goto('/');

    // Should show stats cards (use exact text match to avoid duplicates)
    const mainContent = basePage.page.locator('.flex-1.overflow-auto');
    await expect(mainContent.getByText('Total', { exact: true })).toBeVisible();
    await expect(mainContent.getByText('Working', { exact: true })).toBeVisible();
    await expect(mainContent.getByText('Awaiting', { exact: true })).toBeVisible();
    await expect(mainContent.getByText('Errors', { exact: true })).toBeVisible();
  });

  test('View All button navigates to instances page', async ({ basePage }) => {
    await basePage.goto('/');

    // Click "View All" button
    const viewAllButton = basePage.page.locator('button:has-text("View All")');
    await expect(viewAllButton).toBeVisible();
    await viewAllButton.click();

    // Should navigate to instances page
    await expect(basePage.page).toHaveURL(/.*\/instances$/);
  });

  test('pinned instances appear in Pinned section', async ({ basePage, apiClient }) => {
    // Create a pinned instance
    const instance = await apiClient.createInstance({ name: 'pinned-test', workingDir: '~' });
    await apiClient.updateInstance(instance.id, { isPinned: true });

    // Navigate to home page
    await basePage.goto('/');

    // Should show pinned section with the instance (in main content area, not sidebar)
    const mainContent = basePage.page.locator('.flex-1.overflow-auto');
    // The section header is "★ Pinned" - use locator to find the h3 containing "Pinned"
    await expect(mainContent.locator('h3:has-text("Pinned")')).toBeVisible();
    await expect(mainContent.getByText('pinned-test')).toBeVisible();
  });

  test('clicking pinned instance navigates to it', async ({ basePage, apiClient }) => {
    // Create a pinned instance
    const instance = await apiClient.createInstance({ name: 'pinned-nav-test', workingDir: '~' });
    await apiClient.updateInstance(instance.id, { isPinned: true });

    // Navigate to home page
    await basePage.goto('/');

    // Click on the pinned instance in the main content area (not sidebar)
    const mainContent = basePage.page.locator('.flex-1.overflow-auto');
    await mainContent.getByText('pinned-nav-test').click();

    // Should navigate to that instance
    await expect(basePage.page).toHaveURL(new RegExp(`/instances/${instance.id}`));
  });

  test('recent instances appear on HomePage', async ({ basePage, apiClient }) => {
    // Create some instances (not pinned)
    await apiClient.createInstance({ name: 'recent-1', workingDir: '~' });
    await apiClient.createInstance({ name: 'recent-2', workingDir: '~' });

    // Navigate to home page
    await basePage.goto('/');

    // Should show recent instances section heading
    const mainContent = basePage.page.locator('.flex-1.overflow-auto');
    // The section header is just "Recent"
    const recentHeader = mainContent.locator('h3:has-text("Recent")');
    await expect(recentHeader).toBeVisible();

    // Check that both instances appear in the recent section (sibling of the h3)
    // The structure is: <div><h3>Recent</h3><div class="bg-surface-700">...instances...</div></div>
    const recentSection = recentHeader.locator('..').locator('.bg-surface-700');
    await expect(recentSection.getByText('recent-1')).toBeVisible();
    await expect(recentSection.getByText('recent-2')).toBeVisible();
  });
});
