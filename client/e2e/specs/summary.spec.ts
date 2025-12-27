import { test, expect } from '../fixtures/test-fixtures';

test.describe('Summary Feature', () => {
  test('shows summary dropdown menu in header', async ({ basePage }) => {
    await basePage.goto('/instances');

    // Click the Summary button in the header
    const summaryButton = basePage.page.locator('button:has-text("Summary")');
    await expect(summaryButton).toBeVisible();
    await summaryButton.click();

    // Dropdown should appear with options
    await expect(basePage.page.locator('text=Generate Daily Summary')).toBeVisible();
    await expect(basePage.page.locator('text=Generate Weekly Summary')).toBeVisible();
  });

  test('opens summary modal when clicking daily summary', async ({ basePage }) => {
    await basePage.goto('/instances');

    // Open dropdown
    await basePage.page.locator('button:has-text("Summary")').click();

    // Click daily summary option
    await basePage.page.locator('text=Generate Daily Summary').click();

    // Modal should appear
    await expect(basePage.page.locator('h2:has-text("Daily Summary")')).toBeVisible();
  });

  test('opens summary modal when clicking weekly summary', async ({ basePage }) => {
    await basePage.goto('/instances');

    // Open dropdown
    await basePage.page.locator('button:has-text("Summary")').click();

    // Click weekly summary option
    await basePage.page.locator('text=Generate Weekly Summary').click();

    // Modal should appear with Weekly title
    await expect(basePage.page.locator('h2:has-text("Weekly Summary")')).toBeVisible();
  });

  test('shows loading state or streaming commands in modal', async ({ basePage }) => {
    await basePage.goto('/instances');

    // Open dropdown and generate summary
    await basePage.page.locator('button:has-text("Summary")').click();
    await basePage.page.locator('text=Generate Daily Summary').click();

    // Should see either loading spinner or running commands
    const modal = basePage.page.locator('.fixed.inset-0').filter({ hasText: 'Daily Summary' });
    await expect(modal).toBeVisible();

    // Either loading state or command running state should be visible
    const hasLoadingOrCommands = await basePage.page.locator('text=Running commands').or(
      basePage.page.locator('text=Generating summary with Claude')
    ).first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasLoadingOrCommands).toBe(true);
  });

  test('can close summary modal with Escape key', async ({ basePage }) => {
    await basePage.goto('/instances');

    // Open dropdown and generate summary
    await basePage.page.locator('button:has-text("Summary")').click();
    await basePage.page.locator('text=Generate Daily Summary').click();

    // Wait for modal to be visible
    await expect(basePage.page.locator('h2:has-text("Daily Summary")')).toBeVisible();

    // Press Escape to close
    await basePage.page.keyboard.press('Escape');
    await basePage.page.waitForTimeout(300);

    // Modal should be closed
    await expect(basePage.page.locator('h2:has-text("Daily Summary")')).not.toBeVisible();
  });

  test('can close summary modal by clicking close button', async ({ basePage }) => {
    await basePage.goto('/instances');

    // Open dropdown and generate summary
    await basePage.page.locator('button:has-text("Summary")').click();
    await basePage.page.locator('text=Generate Daily Summary').click();

    // Wait for modal to be visible
    await expect(basePage.page.locator('h2:has-text("Daily Summary")')).toBeVisible();

    // Click close button
    await basePage.page.locator('button:has-text("Close")').click();
    await basePage.page.waitForTimeout(300);

    // Modal should be closed
    await expect(basePage.page.locator('h2:has-text("Daily Summary")')).not.toBeVisible();
  });

  test('dropdown closes when clicking outside', async ({ basePage }) => {
    await basePage.goto('/instances');

    // Open dropdown
    await basePage.page.locator('button:has-text("Summary")').click();
    await expect(basePage.page.locator('text=Generate Daily Summary')).toBeVisible();

    // Click outside the dropdown
    await basePage.page.locator('header').click({ position: { x: 10, y: 10 } });

    // Dropdown should be closed
    await expect(basePage.page.locator('text=Generate Daily Summary')).not.toBeVisible();
  });
});

test.describe('Summary Settings', () => {
  test('shows Work Summaries section in settings', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check Work Summaries section heading exists
    await expect(basePage.page.getByRole('heading', { name: 'Work Summaries' })).toBeVisible();
  });

  test('shows data source checkboxes', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check data source options exist (actual label text from the UI)
    await expect(basePage.page.locator('label').filter({ hasText: 'Pull Requests' }).first()).toBeVisible();
    await expect(basePage.page.locator('label').filter({ hasText: 'Commits' }).first()).toBeVisible();
    await expect(basePage.page.locator('label').filter({ hasText: 'Closed Issues' }).first()).toBeVisible();
  });

  test('can toggle data source checkboxes', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Find the commits checkbox label and click it
    const commitsLabel = basePage.page.locator('label').filter({ hasText: 'Commits' }).filter({ hasText: 'Git commit' });
    await commitsLabel.click();

    // The checkbox in the commits label should now be checked
    const commitsCheckbox = commitsLabel.locator('input[type="checkbox"]');
    await expect(commitsCheckbox).toBeChecked();

    // Click again to uncheck
    await commitsLabel.click();
    await expect(commitsCheckbox).not.toBeChecked();
  });

  test('shows custom prompt textarea', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check custom prompt textarea exists
    await expect(basePage.page.locator('text=Custom Prompt (optional)')).toBeVisible();
    await expect(basePage.page.locator('textarea[placeholder*="default prompt"]')).toBeVisible();
  });

  test('can type in custom prompt textarea', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Find and fill the textarea
    const textarea = basePage.page.locator('textarea[placeholder*="default prompt"]');
    await textarea.fill('Custom test prompt for summary generation');

    // Verify the text was entered
    await expect(textarea).toHaveValue('Custom test prompt for summary generation');
  });

  test('shows view default prompt toggle', async ({ basePage }) => {
    await basePage.goto('/instances');
    await basePage.openSettings();

    // Check that "View default prompt" toggle exists
    await expect(basePage.page.locator('text=View default prompt')).toBeVisible();

    // Click to expand and verify default prompt content is shown
    await basePage.page.locator('text=View default prompt').click();
    await expect(basePage.page.locator('text=You are a helpful assistant')).toBeVisible();
  });
});

test.describe('Summary API', () => {
  test('can call generate-stream endpoint', async ({ page }) => {
    // Test the SSE streaming endpoint directly
    const response = await page.request.post('http://localhost:3456/api/summaries/generate-stream', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        type: 'daily',
        includePRs: true,
        includeCommits: false,
        includeIssues: false,
      },
    });

    // Should get a successful response with SSE content type
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('text/event-stream');
  });

  test('can call generate endpoint (non-streaming)', async ({ page }) => {
    // Test the non-streaming endpoint
    const response = await page.request.post('http://localhost:3456/api/summaries/generate', {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        type: 'daily',
        includePRs: true,
        includeCommits: false,
        includeIssues: false,
      },
    });

    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('summary');
    expect(data.data).toHaveProperty('rawData');
    expect(data.data).toHaveProperty('commandsExecuted');
  });
});
