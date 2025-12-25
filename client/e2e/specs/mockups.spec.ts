import { test, expect } from '../fixtures/test-fixtures';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

test.describe('Mockups Panel', () => {
  const mockupsDir = path.join(os.homedir(), 'mockups');
  const testMockupPath = path.join(mockupsDir, 'e2e-test-mockup.html');

  // Helper to clean all test-created mockup files
  const cleanupTestMockups = () => {
    if (fs.existsSync(testMockupPath)) {
      fs.unlinkSync(testMockupPath);
    }
  };

  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
    cleanupTestMockups();
  });

  test.afterEach(async () => {
    cleanupTestMockups();
  });

  test('can open mockups panel with button', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Click the Mockups button
    await instancesPage.page.locator('button:has-text("Mockups")').click();

    // Mockups panel should be visible
    await expect(instancesPage.page.locator('text=Mockups').first()).toBeVisible();
  });

  test('can open mockups panel with keyboard shortcut', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Wait for expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Use keyboard shortcut Cmd+M
    await instancesPage.page.keyboard.press('Meta+m');

    // Mockups panel should be visible (check for path indicator)
    await expect(instancesPage.page.locator('[title$="/mockups"]')).toBeVisible({ timeout: 5000 });
  });

  test('can view an HTML mockup', async ({ instancesPage }) => {
    // Create a test mockup file first
    if (!fs.existsSync(mockupsDir)) {
      fs.mkdirSync(mockupsDir, { recursive: true });
    }
    fs.writeFileSync(testMockupPath, '<!DOCTYPE html><html><body><h1>Test Mockup</h1><p>E2E test content</p></body></html>');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Wait a moment for file system to settle
    await instancesPage.page.waitForTimeout(500);

    // Open mockups panel
    await instancesPage.page.locator('button:has-text("Mockups")').click();
    await instancesPage.page.waitForTimeout(500);

    // Wait for the file list to load
    const mockupFileButton = instancesPage.page.locator('button:has-text("e2e-test-mockup.html")');
    await expect(mockupFileButton).toBeVisible({ timeout: 5000 });

    // Click on the test mockup to select it
    await mockupFileButton.click();

    // Wait for the mockup to load - the name should appear in the viewer header
    await instancesPage.page.waitForTimeout(500);

    // The viewer header with mockup name and open button should appear
    const mockupHeader = instancesPage.page.locator('text=e2e-test-mockup.html').last();
    await expect(mockupHeader).toBeVisible({ timeout: 5000 });

    // An iframe should be visible for rendering the mockup
    const iframe = instancesPage.page.locator('iframe');
    await expect(iframe).toBeVisible({ timeout: 5000 });
  });

  test('shows empty state with create button when no mockups directory', async ({ instancesPage }) => {
    // Temporarily rename mockups dir if it exists
    const tempDir = path.join(os.homedir(), 'mockups-temp-backup');
    const mockupsExists = fs.existsSync(mockupsDir);
    if (mockupsExists) {
      fs.renameSync(mockupsDir, tempDir);
    }

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();
      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

      // Open mockups panel
      await instancesPage.page.locator('button:has-text("Mockups")').click();
      await instancesPage.page.waitForTimeout(500);

      // Should show empty state message
      await expect(instancesPage.page.locator('text=No mockups folder')).toBeVisible();

      // Should show the create button
      await expect(instancesPage.page.locator('button:has-text("Create mockups/")')).toBeVisible();
    } finally {
      // Restore mockups dir
      if (mockupsExists) {
        fs.renameSync(tempDir, mockupsDir);
      }
    }
  });

  test('can create mockups directory with button', async ({ instancesPage }) => {
    // Temporarily rename mockups dir if it exists
    const tempDir = path.join(os.homedir(), 'mockups-temp-backup');
    const mockupsExists = fs.existsSync(mockupsDir);
    if (mockupsExists) {
      fs.renameSync(mockupsDir, tempDir);
    }

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();
      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

      // Open mockups panel
      await instancesPage.page.locator('button:has-text("Mockups")').click();
      await instancesPage.page.waitForTimeout(500);

      // Verify create button is visible
      const createButton = instancesPage.page.locator('button:has-text("Create mockups/")');
      await expect(createButton).toBeVisible();

      // Click the create button
      await createButton.click();
      await instancesPage.page.waitForTimeout(500);

      // Verify directory was created
      expect(fs.existsSync(mockupsDir)).toBe(true);
    } finally {
      // Clean up: remove the created directory if it exists
      if (fs.existsSync(mockupsDir)) {
        fs.rmdirSync(mockupsDir, { recursive: true });
      }
      // Restore original mockups dir if it existed
      if (mockupsExists) {
        fs.renameSync(tempDir, mockupsDir);
      }
    }
  });

  test('can collapse and expand file browser', async ({ instancesPage }) => {
    // Ensure mockups directory exists with a test mockup
    if (!fs.existsSync(mockupsDir)) {
      fs.mkdirSync(mockupsDir, { recursive: true });
    }
    fs.writeFileSync(testMockupPath, '<!DOCTYPE html><html><body><h1>Test</h1></body></html>');

    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Open mockups panel
    await instancesPage.page.locator('button:has-text("Mockups")').click();
    await instancesPage.page.waitForTimeout(500);

    // File browser should be expanded - "Files" label should be visible
    await expect(instancesPage.page.locator('text=Files').first()).toBeVisible();

    // Find and click the collapse button (there may be multiple, get the one in mockups panel)
    const collapseButton = instancesPage.page.locator('button[title="Collapse file browser"]').last();
    await expect(collapseButton).toBeVisible();
    await collapseButton.click();
    await instancesPage.page.waitForTimeout(300);

    // Expand button should now be visible
    const expandButton = instancesPage.page.locator('button[title="Expand file browser"]').last();
    await expect(expandButton).toBeVisible();

    // Click expand to restore
    await expandButton.click();
    await instancesPage.page.waitForTimeout(300);

    // "Files" label should be visible again
    await expect(instancesPage.page.locator('text=Files').first()).toBeVisible();
  });
});
