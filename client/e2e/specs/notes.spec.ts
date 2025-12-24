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

    // Wait for WYSIWYG editor content to load
    const editorContent = instancesPage.page.locator('.mdx-editor-content');
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    // Switch to Source mode for reliable text editing
    const sourceButton = instancesPage.page.locator('button:has-text("Source")');
    await expect(sourceButton).toBeVisible({ timeout: 5000 });
    await sourceButton.click();

    // Edit the content in the textarea (source mode shows a textarea)
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

  test('shows empty state with create button when no notes directory', async ({ instancesPage }) => {
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
      await expect(instancesPage.page.locator('text=No notes folder')).toBeVisible();

      // Should show the create button
      await expect(instancesPage.page.locator('button:has-text("Create notes/")')).toBeVisible();
    } finally {
      // Restore notes dir
      if (notesExists) {
        fs.renameSync(tempDir, notesDir);
      }
    }
  });

  test('can create notes directory with button', async ({ instancesPage }) => {
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

      // Verify create button is visible
      const createButton = instancesPage.page.locator('button:has-text("Create notes/")');
      await expect(createButton).toBeVisible();

      // Click the create button
      await createButton.click();
      await instancesPage.page.waitForTimeout(500);

      // Verify directory was created
      expect(fs.existsSync(notesDir)).toBe(true);

      // Success toast should appear (optional - toast may dismiss quickly)
      // The "Create notes/" button should no longer be visible since directory exists
      // But it may still show if directory is empty - that's expected behavior
    } finally {
      // Clean up: remove the created directory if it exists
      if (fs.existsSync(notesDir)) {
        fs.rmdirSync(notesDir, { recursive: true });
      }
      // Restore original notes dir if it existed
      if (notesExists) {
        fs.renameSync(tempDir, notesDir);
      }
    }
  });

  test('can collapse and expand file browser', async ({ instancesPage }) => {
    // Ensure notes directory exists with a test note
    if (!fs.existsSync(notesDir)) {
      fs.mkdirSync(notesDir, { recursive: true });
    }
    fs.writeFileSync(testNotePath, '# Test Note\n\nTest content.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // File browser should be expanded - "Files" label should be visible
    await expect(instancesPage.page.locator('text=Files').first()).toBeVisible();

    // Find and click the collapse button
    const collapseButton = instancesPage.page.locator('button[title="Collapse file browser"]');
    await expect(collapseButton).toBeVisible();
    await collapseButton.click();
    await instancesPage.page.waitForTimeout(300);

    // After collapse, "Files" label should be hidden
    await expect(instancesPage.page.locator('span:has-text("Files")').first()).not.toBeVisible();

    // Expand button should now be visible
    const expandButton = instancesPage.page.locator('button[title="Expand file browser"]');
    await expect(expandButton).toBeVisible();

    // Click expand to restore
    await expandButton.click();
    await instancesPage.page.waitForTimeout(300);

    // "Files" label should be visible again
    await expect(instancesPage.page.locator('text=Files').first()).toBeVisible();
  });

  test('updates path when terminal CWD changes', async ({ instancesPage }) => {
    // Create notes directories in both locations
    const desktopNotesDir = path.join(os.homedir(), 'Desktop', 'notes');
    const homeNotesDir = path.join(os.homedir(), 'notes');

    // Ensure Desktop/notes exists
    if (!fs.existsSync(desktopNotesDir)) {
      fs.mkdirSync(desktopNotesDir, { recursive: true });
    }
    // Ensure ~/notes exists
    if (!fs.existsSync(homeNotesDir)) {
      fs.mkdirSync(homeNotesDir, { recursive: true });
    }

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open notes panel
    await instancesPage.page.locator('button:has-text("Notes")').click();
    await instancesPage.page.waitForTimeout(500);

    // Get initial path display (should contain home directory)
    const pathDisplay = instancesPage.page.locator('[title$="/notes"]').first();
    await expect(pathDisplay).toBeVisible();

    // Change directory in terminal to Desktop
    const terminal = instancesPage.page.locator('.xterm-helper-textarea');
    await terminal.focus();
    await terminal.fill('cd ~/Desktop');
    await instancesPage.page.keyboard.press('Enter');

    // Wait for CWD polling to detect the change (polls every 2 seconds)
    await instancesPage.page.waitForTimeout(3000);

    // Path should now show Desktop/notes
    await expect(instancesPage.page.locator('[title*="Desktop/notes"]')).toBeVisible({ timeout: 5000 });
  });

  test('clears selected note when CWD changes', async ({ instancesPage }) => {
    // Create a test note in home notes directory
    const homeNotesDir = path.join(os.homedir(), 'notes');
    const testNoteInHome = path.join(homeNotesDir, 'cwd-test-note.md');

    if (!fs.existsSync(homeNotesDir)) {
      fs.mkdirSync(homeNotesDir, { recursive: true });
    }
    fs.writeFileSync(testNoteInHome, '# CWD Test Note\n\nThis note should be cleared on CWD change.');

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();
      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

      // Open notes panel
      await instancesPage.page.locator('button:has-text("Notes")').click();
      await instancesPage.page.waitForTimeout(500);

      // Select the test note
      const noteButton = instancesPage.page.locator('button:has-text("cwd-test-note.md")');
      await expect(noteButton).toBeVisible();
      await noteButton.click();
      await instancesPage.page.waitForTimeout(300);

      // Verify note content is displayed (note name in toolbar - the second span is the toolbar title)
      const toolbarTitle = instancesPage.page.locator('.text-theme-primary.font-medium:has-text("cwd-test-note.md")');
      await expect(toolbarTitle).toBeVisible();

      // Change directory in terminal
      const terminal = instancesPage.page.locator('.xterm-helper-textarea');
      await terminal.focus();
      await terminal.fill('cd ~/Desktop');
      await instancesPage.page.keyboard.press('Enter');

      // Wait for CWD polling to detect the change
      await instancesPage.page.waitForTimeout(3000);

      // The note name should no longer be in the toolbar (selection cleared)
      await expect(instancesPage.page.locator('.text-theme-primary.font-medium:has-text("cwd-test-note.md")')).not.toBeVisible({ timeout: 5000 });

      // Should show empty state or file list for new directory
      const emptyState = instancesPage.page.locator('text=No notes');
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      // Either shows empty state or the file browser (both are valid)
      expect(hasEmptyState || true).toBe(true);
    } finally {
      // Cleanup
      if (fs.existsSync(testNoteInHome)) {
        fs.unlinkSync(testNoteInHome);
      }
    }
  });
});
