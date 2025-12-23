import { test, expect } from '../fixtures/test-fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('File Watcher', () => {
  const notesDir = path.join(os.homedir(), 'notes');
  const testNotePath = path.join(notesDir, 'watcher-test.md');

  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
    // Ensure notes directory exists
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }
    // Create test note
    fs.writeFileSync(testNotePath, '# Original Content\n\nThis is the original content.');
  });

  test.afterEach(async () => {
    // Clean up test note
    if (fs.existsSync(testNotePath)) {
      fs.unlinkSync(testNotePath);
    }
  });

  test('shows notification when file is modified externally', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note to view it
    await instancesPage.page.locator('button:has-text("watcher-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Verify content is displayed
    await expect(instancesPage.page.locator('h1:has-text("Original Content")')).toBeVisible();

    // Modify the file externally (simulate external editor)
    fs.writeFileSync(testNotePath, '# Modified Content\n\nThis content was modified externally.');

    // Wait for the file watcher to detect the change (debounced)
    await instancesPage.page.waitForTimeout(2000);

    // Notification banner should appear
    await expect(instancesPage.page.locator('text=This file was modified externally')).toBeVisible({ timeout: 5000 });
  });

  test('reload button fetches new content', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("watcher-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Verify original content
    await expect(instancesPage.page.locator('h1:has-text("Original Content")')).toBeVisible();

    // Modify the file externally
    fs.writeFileSync(testNotePath, '# Updated Content\n\nThis is the updated content.');

    // Wait for notification
    await instancesPage.page.waitForTimeout(2000);
    await expect(instancesPage.page.locator('text=This file was modified externally')).toBeVisible({ timeout: 5000 });

    // Click Reload button
    await instancesPage.page.locator('button:has-text("Reload")').click();
    await instancesPage.page.waitForTimeout(500);

    // New content should be displayed
    await expect(instancesPage.page.locator('h1:has-text("Updated Content")')).toBeVisible();

    // Notification should be dismissed
    await expect(instancesPage.page.locator('text=This file was modified externally')).not.toBeVisible();
  });

  test('dismiss button hides notification', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("watcher-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Modify the file externally
    fs.writeFileSync(testNotePath, '# Modified Content\n\nModified externally.');

    // Wait for notification
    await instancesPage.page.waitForTimeout(2000);
    await expect(instancesPage.page.locator('text=This file was modified externally')).toBeVisible({ timeout: 5000 });

    // Click dismiss button (X button)
    await instancesPage.page.locator('button[title="Dismiss"]').click();
    await instancesPage.page.waitForTimeout(300);

    // Notification should be dismissed
    await expect(instancesPage.page.locator('text=This file was modified externally')).not.toBeVisible();

    // Original content should still be shown (not reloaded)
    await expect(instancesPage.page.locator('h1:has-text("Original Content")')).toBeVisible();
  });

  test('shows conflict warning when file modified while editing', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("watcher-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Enter edit mode
    await instancesPage.page.locator('button:has-text("Edit")').click();
    await instancesPage.page.waitForTimeout(300);

    // Modify the file externally while in edit mode
    fs.writeFileSync(testNotePath, '# External Change\n\nThis was changed externally.');

    // Wait for notification
    await instancesPage.page.waitForTimeout(2000);

    // Should show conflict warning about unsaved changes
    await expect(instancesPage.page.locator('text=Your unsaved changes may conflict')).toBeVisible({ timeout: 5000 });
  });

  test('handles file deletion gracefully', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Click on the test note
    await instancesPage.page.locator('button:has-text("watcher-test.md")').click();
    await instancesPage.page.waitForTimeout(500);

    // Delete the file externally
    fs.unlinkSync(testNotePath);

    // Wait for notification
    await instancesPage.page.waitForTimeout(2000);

    // Should show deletion notification
    await expect(instancesPage.page.locator('text=This file was deleted externally')).toBeVisible({ timeout: 5000 });
  });
});
