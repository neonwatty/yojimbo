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

  test.skip('shows notification when file is modified externally', async ({ instancesPage }) => {
    // TODO: Flaky in CI - file watcher timing issues need investigation
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();

    // Wait for file list and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("watcher-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for WYSIWYG editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });
    await expect(instancesPage.page.locator('.mdx-editor-content h1:has-text("Original Content")')).toBeVisible({ timeout: 5000 });

    // Modify the file externally (simulate external editor)
    fs.writeFileSync(testNotePath, '# Modified Content\n\nThis content was modified externally.');

    // Wait for the file watcher to detect the change (debounced)
    await instancesPage.page.waitForTimeout(2000);

    // Notification banner should appear
    await expect(instancesPage.page.locator('text=This file was modified externally')).toBeVisible({ timeout: 5000 });
  });

  test.skip('reload button fetches new content', async ({ instancesPage }) => {
    // TODO: Flaky in CI - file watcher timing issues need investigation
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();

    // Wait for file list and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("watcher-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for WYSIWYG editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });
    await expect(instancesPage.page.locator('.mdx-editor-content h1:has-text("Original Content")')).toBeVisible({ timeout: 5000 });

    // Modify the file externally
    fs.writeFileSync(testNotePath, '# Updated Content\n\nThis is the updated content.');

    // Wait for notification
    await instancesPage.page.waitForTimeout(2000);
    await expect(instancesPage.page.locator('text=This file was modified externally')).toBeVisible({ timeout: 5000 });

    // Click Reload button
    await instancesPage.page.locator('button:has-text("Reload")').click();
    await instancesPage.page.waitForTimeout(500);

    // New content should be displayed
    await expect(instancesPage.page.locator('.mdx-editor-content h1:has-text("Updated Content")')).toBeVisible({ timeout: 5000 });

    // Notification should be dismissed
    await expect(instancesPage.page.locator('text=This file was modified externally')).not.toBeVisible();
  });

  test.skip('dismiss button hides notification', async ({ instancesPage }) => {
    // TODO: Flaky in CI - file watcher timing issues need investigation
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();

    // Wait for file list and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("watcher-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for WYSIWYG editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });
    await expect(instancesPage.page.locator('.mdx-editor-content h1:has-text("Original Content")')).toBeVisible({ timeout: 5000 });

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
    await expect(instancesPage.page.locator('.mdx-editor-content h1:has-text("Original Content")')).toBeVisible();
  });

  test.skip('shows conflict warning when file modified while editing', async ({ instancesPage }) => {
    // TODO: Flaky in CI - file watcher timing issues need investigation
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();

    // Wait for file list and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("watcher-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for WYSIWYG editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Switch to Source mode to make edits
    const sourceButton = instancesPage.page.locator('button:has-text("Source")');
    await expect(sourceButton).toBeVisible({ timeout: 5000 });
    await sourceButton.click();

    // Make an edit to trigger dirty state
    const textarea = instancesPage.page.locator('textarea:not([aria-label="Terminal input"])');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('# Modified by User\n\nThis was modified by the user.');

    // Modify the file externally while in edit mode
    fs.writeFileSync(testNotePath, '# External Change\n\nThis was changed externally.');

    // Wait for notification
    await instancesPage.page.waitForTimeout(2000);

    // Should show conflict warning about unsaved changes
    await expect(instancesPage.page.locator('text=Your unsaved changes may conflict')).toBeVisible({ timeout: 5000 });
  });

  test.skip('handles file deletion gracefully', async ({ instancesPage }) => {
    // TODO: Flaky in CI - file watcher timing issues need investigation
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();

    // Wait for file list and click on the test note
    const noteButton = instancesPage.page.locator('button:has-text("watcher-test.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });
    await noteButton.click();

    // Wait for WYSIWYG editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Delete the file externally
    fs.unlinkSync(testNotePath);

    // Wait for notification
    await instancesPage.page.waitForTimeout(2000);

    // Should show deletion notification
    await expect(instancesPage.page.locator('text=This file was deleted externally')).toBeVisible({ timeout: 5000 });
  });
});
