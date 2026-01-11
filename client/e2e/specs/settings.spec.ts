import { test, expect } from '../fixtures/test-fixtures';

test.describe('Settings Modal', () => {
  test('shows theme options', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check theme buttons are visible
    await expect(basePage.page.locator('button:has-text("light")')).toBeVisible();
    await expect(basePage.page.locator('button:has-text("dark")')).toBeVisible();
    await expect(basePage.page.locator('button:has-text("system")')).toBeVisible();
  });

  test('can change theme to light', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Click light theme button
    await basePage.page.locator('button:has-text("light")').click();

    // Verify the light button is selected (has active class)
    const lightButton = basePage.page.locator('button:has-text("light")');
    await expect(lightButton).toHaveClass(/bg-surface-500/);
  });

  test('can change theme to dark', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // First switch to light
    await basePage.page.locator('button:has-text("light")').click();
    await basePage.page.waitForTimeout(200);

    // Then switch to dark
    await basePage.page.locator('button:has-text("dark")').click();

    // Verify the dark button is selected
    const darkButton = basePage.page.locator('button:has-text("dark")');
    await expect(darkButton).toHaveClass(/bg-surface-500/);
  });

  test('shows terminal font size selector', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check font size select is visible
    const fontSizeSelect = basePage.page.locator('select').first();
    await expect(fontSizeSelect).toBeVisible();
  });

  test('shows terminal font family selector', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check font family select is visible
    const fontFamilySelect = basePage.page.locator('select').nth(1);
    await expect(fontFamilySelect).toBeVisible();

    // Verify it has font options
    await expect(fontFamilySelect.locator('option:has-text("JetBrains Mono")')).toBeAttached();
  });

  test('clicking backdrop closes modal', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Click the backdrop (fixed overlay)
    await basePage.page.locator('.fixed.inset-0').first().click({ position: { x: 10, y: 10 } });

    // Modal should be closed
    await expect(basePage.page.locator('h2:has-text("Settings")')).not.toBeVisible();
  });

  test('shows version number in footer', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check version is displayed in the settings modal (format: v0.x.x)
    const settingsModal = basePage.page.locator('[role="dialog"]');
    await expect(settingsModal.locator('text=/v\\d+\\.\\d+\\.\\d+/')).toBeVisible();
  });

  test('shows danger zone with database reset option', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check danger zone section exists
    await expect(basePage.page.locator('text=Danger Zone')).toBeVisible();

    // Check database reset button exists but is disabled (the red one in danger zone)
    const dangerZoneResetButton = basePage.page.locator('.bg-red-500\\/10 button:has-text("Reset")');
    await expect(dangerZoneResetButton).toBeVisible();
    await expect(dangerZoneResetButton).toBeDisabled();
  });

  test('reset button is disabled until RESET is typed', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    const resetInput = basePage.page.locator('input[placeholder*="RESET"]');
    // Target the danger zone reset button specifically (the red one)
    const dangerZoneResetButton = basePage.page.locator('.bg-red-500\\/10 button:has-text("Reset")');

    // Button should be disabled initially
    await expect(dangerZoneResetButton).toBeDisabled();

    // Type partial text - button still disabled
    await resetInput.fill('RES');
    await expect(dangerZoneResetButton).toBeDisabled();

    // Type full RESET - button becomes enabled
    await resetInput.fill('RESET');
    await expect(dangerZoneResetButton).toBeEnabled();
  });

  test('shows maintenance section with reset instance status button', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check maintenance section exists
    await expect(basePage.page.locator('text=Maintenance')).toBeVisible();
    await expect(basePage.page.locator('text=Reset Instance Status')).toBeVisible();

    // Check the reset instance status button is enabled (no confirmation required)
    const maintenanceResetButton = basePage.page.locator('button:has-text("Reset")').first();
    await expect(maintenanceResetButton).toBeVisible();
    await expect(maintenanceResetButton).toBeEnabled();
  });

  test('database reset API clears all instances', async ({ apiClient }) => {
    // Create an instance first
    await apiClient.createInstance({ name: 'test-reset', workingDir: '~' });

    // Verify instance exists
    const instancesBefore = await apiClient.listInstances();
    expect(instancesBefore.length).toBeGreaterThan(0);

    // Perform reset via API
    const result = await apiClient.resetDatabase();
    expect(result.reset).toBe(true);

    // Verify instances are cleared
    const instancesAfter = await apiClient.listInstances();
    expect(instancesAfter.length).toBe(0);
  });
});

test.describe('Claude Code Aliases Settings', () => {
  test('shows Claude Code Aliases section in settings', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check Claude Code Aliases section heading exists
    await expect(basePage.page.locator('text=Claude Code Aliases')).toBeVisible();
  });

  test('shows default aliases (YOLO Mode and Default)', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check default aliases are listed
    await expect(basePage.page.locator('text=YOLO Mode')).toBeVisible();

    // Check the YOLO command is shown (truncated in UI so use partial match)
    await expect(basePage.page.locator('code:has-text("claude --dangerously-skip-permissions")')).toBeVisible();
  });

  test('can add a new alias', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Click Add Alias button
    await basePage.page.locator('text=Add Alias').click();

    // Wait for the form to appear
    const addForm = basePage.page.locator('.mb-3.space-y-2').filter({ has: basePage.page.locator('input[placeholder*="Alias name"]') });
    await expect(addForm).toBeVisible();

    // Fill in the form
    await addForm.locator('input[placeholder*="Alias name"]').fill('Test Alias');
    await addForm.locator('input[placeholder*="Command"]').fill('claude --verbose');

    // Click Add button within the form
    await addForm.locator('button:has-text("Add")').click();

    // Wait for the form to close (form should disappear)
    await expect(addForm).not.toBeVisible();

    // The new alias should appear in the list
    await expect(basePage.page.locator('text=Test Alias')).toBeVisible();
    await expect(basePage.page.locator('code:has-text("claude --verbose")')).toBeVisible();
  });

  test('can remove an alias', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // First add a new alias to delete
    await basePage.page.locator('text=Add Alias').click();

    // Wait for the form to appear
    const addForm = basePage.page.locator('.mb-3.space-y-2').filter({ has: basePage.page.locator('input[placeholder*="Alias name"]') });
    await expect(addForm).toBeVisible();

    // Fill in the form
    await addForm.locator('input[placeholder*="Alias name"]').fill('To Delete');
    await addForm.locator('input[placeholder*="Command"]').fill('claude --test');

    // Click Add button within the form
    await addForm.locator('button:has-text("Add")').click();

    // Wait for the form to close
    await expect(addForm).not.toBeVisible();

    // Verify it was added
    await expect(basePage.page.locator('text=To Delete')).toBeVisible();

    // Find and click remove button for this alias (title is "Remove")
    const aliasCard = basePage.page.locator('.bg-surface-800').filter({ hasText: 'To Delete' });

    // Handle confirmation dialog
    basePage.page.once('dialog', dialog => dialog.accept());
    await aliasCard.locator('button[title="Remove"]').click();

    // Alias should be removed
    await expect(basePage.page.locator('text=To Delete')).not.toBeVisible();
  });
});
