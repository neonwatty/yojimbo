import { test, expect } from '../fixtures/test-fixtures';

test.describe('Instance Management', () => {
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  test('can create a new instance', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // After creating, app navigates to expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
  });

  test('new instance shows in expanded view after creation', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // After creating, should be in expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Should see the instance name in header (use title attribute for the editable name)
    await expect(instancesPage.page.locator('[title="Double-click to rename"]')).toBeVisible({ timeout: 5000 });
  });

  test('can return to overview from expanded view', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Click back button
    await instancesPage.page.locator('button[title="Back to overview (Escape)"]').click();

    // Should be back on overview
    await expect(instancesPage.page).toHaveURL(/.*\/instances$/);
  });

  test('can close an instance from overview', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Go back to overview
    await instancesPage.page.locator('button[title="Back to overview (Escape)"]').click();
    await expect(instancesPage.page).toHaveURL(/.*\/instances$/);

    // Now we should see the instance card
    await instancesPage.page.waitForTimeout(500);
    const initialCount = await instancesPage.getInstanceCount();
    expect(initialCount).toBeGreaterThan(0);

    // Hover and click close button
    const firstCard = await instancesPage.getInstanceCardByIndex(0);
    await firstCard.hover();
    const closeButton = firstCard.locator('button[title="Close"]');
    await closeButton.click();

    // Wait for instance to be removed
    await instancesPage.page.waitForTimeout(500);

    const newCount = await instancesPage.getInstanceCount();
    expect(newCount).toBe(initialCount - 1);
  });

  test('can expand instance from overview via expand button', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view, then go back
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    await instancesPage.page.locator('button[title="Back to overview (Escape)"]').click();
    await expect(instancesPage.page).toHaveURL(/.*\/instances$/);
    await instancesPage.page.waitForTimeout(500);

    // Hover and click expand button
    const firstCard = await instancesPage.getInstanceCardByIndex(0);
    await firstCard.hover();
    const expandButton = firstCard.locator('button[title="Expand"]');
    await expandButton.click();

    // URL should change to include instance ID
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/.+/);
  });

  test('can expand instance from overview via double-click', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view, then go back
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    await instancesPage.page.locator('button[title="Back to overview (Escape)"]').click();
    await expect(instancesPage.page).toHaveURL(/.*\/instances$/);
    await instancesPage.page.waitForTimeout(500);

    // Double-click the first instance card
    const firstCard = await instancesPage.getInstanceCardByIndex(0);
    await firstCard.dblclick();

    // URL should change to include instance ID
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/.+/);
  });
});
