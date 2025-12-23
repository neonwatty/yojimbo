import { test, expect } from '../fixtures/test-fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Notes Panel', () => {
  const notesDir = path.join(os.homedir(), 'notes');
  const testNotePath = path.join(notesDir, 'e2e-test-note.md');

  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
    // Clean up any test notes
    if (fs.existsSync(testNotePath)) {
      fs.unlinkSync(testNotePath);
    }
  });

  test.afterEach(async () => {
    // Clean up test notes
    if (fs.existsSync(testNotePath)) {
      fs.unlinkSync(testNotePath);
    }
  });

  test('can open notes panel with button', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Click the Notes button
    await instancesPage.page.locator('button:has-text("Notes")').click();

    // Notes panel should be visible
    await expect(instancesPage.page.locator('text=Notes').first()).toBeVisible();
  });

  test('can open notes panel with keyboard shortcut', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Use keyboard shortcut Cmd+Shift+N
    await instancesPage.page.keyboard.press('Meta+Shift+n');

    // Notes panel should be visible
    await expect(instancesPage.page.locator('button[title="New note"]')).toBeVisible();
  });

  test('can create a new note', async ({ instancesPage }) => {
    // Ensure notes directory exists
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Handle the prompt dialog for note name
    instancesPage.page.once('dialog', async (dialog) => {
      await dialog.accept('e2e-test-note');
    });

    // Click the new note button
    await instancesPage.page.locator('button[title="New note"]').click();

    // Wait for note to be created and selected
    await instancesPage.page.waitForTimeout(500);

    // Note should appear in the list (use the button in the file browser)
    await expect(instancesPage.page.locator('button:has-text("e2e-test-note.md")')).toBeVisible();

    // Verify file was created
    expect(fs.existsSync(testNotePath)).toBe(true);
  });

  test('can edit and save a note', async ({ instancesPage }) => {
    // Create a test note file first
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }
    fs.writeFileSync(testNotePath, '# Test Note\n\nOriginal content.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();

    // Wait for the file list to load
    const noteButton = instancesPage.page.locator('button:has-text("e2e-test-note.md")');
    await expect(noteButton).toBeVisible({ timeout: 5000 });

    // Click on the test note to select it and wait for content to load
    await noteButton.click();

    // Wait for the note name to appear in the editor toolbar (indicates content loaded)
    await expect(instancesPage.page.locator('span:has-text("e2e-test-note.md")')).toBeVisible({ timeout: 5000 });

    // Wait for the Edit button to appear
    const editButton = instancesPage.page.locator('button:has-text("Edit")');
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // Edit the content in the textarea (use the notes panel textarea, not terminal)
    const textarea = instancesPage.page.locator('textarea:not([aria-label="Terminal input"])');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('# Test Note\n\nEdited content from E2E test.');

    // Click Save button
    await instancesPage.page.locator('button:has-text("Save")').click();
    await instancesPage.page.waitForTimeout(500);

    // Verify file was updated
    const content = fs.readFileSync(testNotePath, 'utf-8');
    expect(content).toContain('Edited content from E2E test');
  });

  test('shows empty state when no notes directory', async ({ instancesPage }) => {
    // Temporarily rename notes dir if it exists
    const tempDir = path.join(os.homedir(), 'notes-temp-backup');
    const notesExists = fs.existsSync(notesDir);
    if (notesExists) {
      fs.renameSync(notesDir, tempDir);
    }

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();
      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

      // Open notes panel
      await instancesPage.page.locator('button:has-text("Notes")').click();
      await instancesPage.page.waitForTimeout(500);

      // Should show empty state message
      await expect(instancesPage.page.locator('text=No notes folder found')).toBeVisible();
    } finally {
      // Restore notes dir
      if (notesExists) {
        fs.renameSync(tempDir, notesDir);
      }
    }
  });
});
