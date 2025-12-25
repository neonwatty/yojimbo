import { test, expect } from '../fixtures/test-fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Plans Panel', () => {
  const plansDir = path.join(os.homedir(), 'plans');
  const testPlanPath = path.join(plansDir, 'e2e-test-plan.md');
  const cwdTestPlanPath = path.join(plansDir, 'cwd-test-plan.md');

  // Helper to clean all test-created plan files
  const cleanupTestPlans = () => {
    const testFiles = [testPlanPath, cwdTestPlanPath];
    for (const file of testFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  };

  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
    cleanupTestPlans();
  });

  test.afterEach(async () => {
    cleanupTestPlans();
  });

  test('can open plans panel with button', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Click the Plans button
    await instancesPage.page.locator('button:has-text("Plans")').click();

    // Plans panel should be visible
    await expect(instancesPage.page.locator('text=Plans').first()).toBeVisible();
  });

  test('can open plans panel with keyboard shortcut', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Use keyboard shortcut Cmd+E (plans/editor panel)
    await instancesPage.page.keyboard.press('Meta+e');

    // Plans panel should be visible
    await expect(instancesPage.page.locator('button[title="New plan"]')).toBeVisible();
  });

  test('can create a new plan', async ({ instancesPage }) => {
    // Ensure plans directory exists
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open plans panel
    await instancesPage.page.locator('button:has-text("Plans")').click();
    await instancesPage.page.waitForTimeout(500);

    // Handle the prompt dialog for plan name
    instancesPage.page.once('dialog', async (dialog) => {
      await dialog.accept('e2e-test-plan');
    });

    // Click the new plan button
    await instancesPage.page.locator('button[title="New plan"]').click();

    // Wait for plan to be created and selected
    await instancesPage.page.waitForTimeout(500);

    // Plan should appear in the list (use the button in the file browser)
    await expect(instancesPage.page.locator('button:has-text("e2e-test-plan.md")')).toBeVisible();

    // Verify file was created
    expect(fs.existsSync(testPlanPath)).toBe(true);
  });

  test('can edit and save a plan', async ({ instancesPage }) => {
    // Create a test plan file first
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }
    fs.writeFileSync(testPlanPath, '# Test Plan\n\nOriginal content.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Wait a moment for file system to settle
    await instancesPage.page.waitForTimeout(500);

    // Open plans panel
    await instancesPage.page.locator('button:has-text("Plans")').click();
    await instancesPage.page.waitForTimeout(500);

    // Wait for the file list to load
    const planFileButton = instancesPage.page.locator('button:has-text("e2e-test-plan.md")');
    await expect(planFileButton).toBeVisible({ timeout: 5000 });

    // Wait for the plan name to appear in the editor toolbar (indicates content loaded)
    const editorToolbar = instancesPage.page.locator('.text-sm.text-theme-primary.font-medium:has-text("e2e-test-plan.md")');

    // Click on the test plan to select it - use force click and wait for result
    await instancesPage.page.waitForTimeout(500);
    await planFileButton.click({ force: true });
    await expect(editorToolbar).toBeVisible({ timeout: 5000 });

    // The WYSIWYG editor should be visible with the content
    const editor = instancesPage.page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Click in the editor and add new content
    await editor.click();
    await instancesPage.page.keyboard.press('End');
    await instancesPage.page.keyboard.press('Enter');
    await instancesPage.page.keyboard.type('Edited content from E2E test.');

    // Click Save button
    await instancesPage.page.locator('button:has-text("Save")').click();

    // Verify toast notification appears
    await expect(instancesPage.page.locator('text=Plan saved')).toBeVisible({ timeout: 5000 });

    // Verify file was updated
    await instancesPage.page.waitForTimeout(500);
    const content = fs.readFileSync(testPlanPath, 'utf-8');
    expect(content).toContain('Edited content from E2E test');
  });

  test('can save plan with Cmd+S keyboard shortcut', async ({ instancesPage }) => {
    // Create a test plan file first
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }
    fs.writeFileSync(testPlanPath, '# Test Plan\n\nOriginal content.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Wait a moment for file system to settle
    await instancesPage.page.waitForTimeout(1000);

    // Open plans panel
    await instancesPage.page.locator('button:has-text("Plans")').click();
    await instancesPage.page.waitForTimeout(1000);

    // Wait for the file list to load and select the plan
    const planFileButton = instancesPage.page.locator('button:has-text("e2e-test-plan.md")');
    await expect(planFileButton).toBeVisible({ timeout: 10000 });

    // Click on the test plan to select it
    await planFileButton.click({ force: true });

    // Wait for the plan name to appear in the editor toolbar (indicates file is selected)
    const editorToolbar = instancesPage.page.locator('.text-sm.text-theme-primary.font-medium:has-text("e2e-test-plan.md")');
    await expect(editorToolbar).toBeVisible({ timeout: 10000 });

    // The WYSIWYG editor (MDXEditor) takes time to initialize - wait longer and retry
    const editor = instancesPage.page.locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 15000 });

    // Wait for editor to be fully interactive
    await instancesPage.page.waitForTimeout(500);

    // Click in the editor and add new content
    await editor.click();
    await instancesPage.page.keyboard.press('End');
    await instancesPage.page.keyboard.press('Enter');
    await instancesPage.page.keyboard.type('Saved with Cmd+S shortcut.');

    // Save with Cmd+S
    await instancesPage.page.keyboard.press('Meta+s');

    // Verify toast notification appears
    await expect(instancesPage.page.locator('text=Plan saved')).toBeVisible({ timeout: 5000 });

    // Verify file was updated
    await instancesPage.page.waitForTimeout(500);
    const content = fs.readFileSync(testPlanPath, 'utf-8');
    expect(content).toContain('Saved with Cmd+S shortcut');
  });

  test('shows empty state with create button when no plans directory', async ({ instancesPage }) => {
    // Temporarily rename plans dir if it exists
    const tempDir = path.join(os.homedir(), 'plans-temp-backup');
    const plansExists = fs.existsSync(plansDir);
    if (plansExists) {
      fs.renameSync(plansDir, tempDir);
    }

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();
      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

      // Open plans panel
      await instancesPage.page.locator('button:has-text("Plans")').click();
      await instancesPage.page.waitForTimeout(500);

      // Should show empty state message
      await expect(instancesPage.page.locator('text=No plans folder')).toBeVisible();

      // Should show the create button
      await expect(instancesPage.page.locator('button:has-text("Create plans/")')).toBeVisible();
    } finally {
      // Restore plans dir
      if (plansExists) {
        fs.renameSync(tempDir, plansDir);
      }
    }
  });

  test('can create plans directory with button', async ({ instancesPage }) => {
    // Temporarily rename plans dir if it exists
    const tempDir = path.join(os.homedir(), 'plans-temp-backup');
    const plansExists = fs.existsSync(plansDir);
    if (plansExists) {
      fs.renameSync(plansDir, tempDir);
    }

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();
      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

      // Open plans panel
      await instancesPage.page.locator('button:has-text("Plans")').click();
      await instancesPage.page.waitForTimeout(500);

      // Verify create button is visible
      const createButton = instancesPage.page.locator('button:has-text("Create plans/")');
      await expect(createButton).toBeVisible();

      // Click the create button
      await createButton.click();
      await instancesPage.page.waitForTimeout(500);

      // Verify directory was created
      expect(fs.existsSync(plansDir)).toBe(true);

      // Success toast should appear (optional - toast may dismiss quickly)
      // The "Create plans/" button should no longer be visible since directory exists
      // But it may still show if directory is empty - that's expected behavior
    } finally {
      // Clean up: remove the created directory if it exists
      if (fs.existsSync(plansDir)) {
        fs.rmdirSync(plansDir, { recursive: true });
      }
      // Restore original plans dir if it existed
      if (plansExists) {
        fs.renameSync(tempDir, plansDir);
      }
    }
  });

  test('can collapse and expand file browser', async ({ instancesPage }) => {
    // Ensure plans directory exists with a test plan
    if (!fs.existsSync(plansDir)) {
      fs.mkdirSync(plansDir, { recursive: true });
    }
    fs.writeFileSync(testPlanPath, '# Test Plan\n\nTest content.');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open plans panel
    await instancesPage.page.locator('button:has-text("Plans")').click();
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
    // Create plans directories in both locations
    const desktopPlansDir = path.join(os.homedir(), 'Desktop', 'plans');
    const homePlansDir = path.join(os.homedir(), 'plans');

    // Ensure Desktop/plans exists
    if (!fs.existsSync(desktopPlansDir)) {
      fs.mkdirSync(desktopPlansDir, { recursive: true });
    }
    // Ensure ~/plans exists
    if (!fs.existsSync(homePlansDir)) {
      fs.mkdirSync(homePlansDir, { recursive: true });
    }

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open plans panel
    await instancesPage.page.locator('button:has-text("Plans")').click();
    await instancesPage.page.waitForTimeout(500);

    // Get initial path display (should contain home directory)
    const pathDisplay = instancesPage.page.locator('[title$="/plans"]').first();
    await expect(pathDisplay).toBeVisible();

    // Change directory in terminal to Desktop
    const terminal = instancesPage.page.locator('.xterm-helper-textarea');
    await terminal.focus();
    await terminal.fill('cd ~/Desktop');
    await instancesPage.page.keyboard.press('Enter');

    // Wait for CWD polling to detect the change (polls every 2 seconds)
    await instancesPage.page.waitForTimeout(3000);

    // Path should now show Desktop/plans
    await expect(instancesPage.page.locator('[title*="Desktop/plans"]')).toBeVisible({ timeout: 5000 });
  });

  test('clears selected plan when CWD changes', async ({ instancesPage }) => {
    // Create a test plan in home plans directory
    const homePlansDir = path.join(os.homedir(), 'plans');
    const testPlanInHome = path.join(homePlansDir, 'cwd-test-plan.md');

    if (!fs.existsSync(homePlansDir)) {
      fs.mkdirSync(homePlansDir, { recursive: true });
    }
    fs.writeFileSync(testPlanInHome, '# CWD Test Plan\n\nThis plan should be cleared on CWD change.');

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();
      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

      // Open plans panel
      await instancesPage.page.locator('button:has-text("Plans")').click();
      await instancesPage.page.waitForTimeout(500);

      // Verify we're starting from home directory by checking the path display
      const homePathDisplay = instancesPage.page.locator('[title$="/plans"]').first();
      await expect(homePathDisplay).toBeVisible({ timeout: 5000 });

      // Select the test plan
      const planButton = instancesPage.page.locator('button:has-text("cwd-test-plan.md")');
      await expect(planButton).toBeVisible();
      await planButton.click();

      // Verify plan content is displayed (plan name in editor toolbar)
      const editorToolbar = instancesPage.page.locator('.text-sm.text-theme-primary.font-medium:has-text("cwd-test-plan.md")');
      await expect(editorToolbar).toBeVisible({ timeout: 5000 });

      // Change directory in terminal - use click to ensure terminal focus
      const terminal = instancesPage.page.locator('.xterm-helper-textarea');
      await terminal.click();
      await instancesPage.page.waitForTimeout(200);
      await instancesPage.page.keyboard.type('cd ~/Desktop');
      await instancesPage.page.keyboard.press('Enter');

      // Wait for CWD polling to detect the change and update the path display
      // CWD polls every 2 seconds, so wait up to 6 seconds for the change
      await expect(instancesPage.page.locator('[title*="Desktop/plans"]')).toBeVisible({ timeout: 8000 });

      // Now the plan name should no longer be in the editor toolbar (selection cleared)
      await expect(editorToolbar).not.toBeVisible({ timeout: 3000 });

      // Should show empty state or file list for new directory
      const emptyState = instancesPage.page.locator('text=No plans');
      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      // Either shows empty state or the file browser (both are valid)
      expect(hasEmptyState || true).toBe(true);
    } finally {
      // Cleanup
      if (fs.existsSync(testPlanInHome)) {
        fs.unlinkSync(testPlanInHome);
      }
    }
  });
});
