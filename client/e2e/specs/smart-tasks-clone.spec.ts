import { test, expect } from '@playwright/test';

test.describe('Smart Tasks Clone & Create Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    // Wait for the app to load
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 }).catch(() => {
      // App loaded indicator might not exist, continue anyway
    });
  });

  test.describe('Clone Setup Modal', () => {
    // Skipped: Requires Smart Tasks modal to be open with parsed tasks
    // This test needs API mocking to properly test the clone flow
    test.skip('should not show clone button when no tasks are parsed', async ({ page }) => {
      // This test requires the Smart Tasks feature to be active
      // and would need API mocking to return tasks with unknown_project clarity
      // For now, we verify the basic page loads
      await expect(page.locator('header')).toBeVisible();
    });

    // Note: Full E2E tests for the clone flow would require:
    // 1. Mocking the smart-tasks/parse endpoint to return tasks with unknown_project
    // 2. Mocking the smart-tasks/validate-path endpoint
    // 3. Mocking the smart-tasks/setup-project endpoint
    // These are better tested as integration tests with msw or similar

    test.skip('should show clone modal when clicking Clone & Create button', async ({ page }) => {
      // This test would need mock API responses
      // Skipped until we set up API mocking for E2E tests

      // Open smart tasks panel
      await page.click('[data-testid="smart-tasks-button"]');

      // Enter a task that would trigger GitHub repo detection
      await page.fill('[data-testid="smart-tasks-input"]', 'Fix bug in bugdrop project');
      await page.click('[data-testid="smart-tasks-parse"]');

      // Wait for parsed results
      await page.waitForSelector('[data-testid="parsed-tasks-review"]');

      // Click the clone button
      await page.click('button:has-text("Clone")');

      // Modal should be visible
      await expect(page.locator('[data-testid="clone-setup-modal"]')).toBeVisible();
    });
  });

  test.describe('Path Validation UI', () => {
    test.skip('should show validation feedback on path input', async ({ page }) => {
      // This test requires API mocking
      // When mocked, we would test:
      // - Green checkmark for valid paths
      // - Yellow warning for existing directories
      // - Red error for missing parent directories
    });
  });

  test.describe('Setup Progress', () => {
    test.skip('should show progress indicators during setup', async ({ page }) => {
      // This test requires API mocking and WebSocket mocking
      // When mocked, we would test:
      // - "Cloning" step indicator
      // - "Creating instance" step indicator
      // - "Complete" state with success message
      // - Error state with retry option
    });
  });
});

// Test data for future API mocking
export const mockSmartTasksParseResponse = {
  tasks: [
    {
      id: 'task-1',
      originalText: 'Fix bug in bugdrop',
      title: 'Fix bug in bugdrop',
      type: 'bug' as const,
      projectId: null,
      projectConfidence: 0,
      clarity: 'unknown_project' as const,
      clarificationNeeded: {
        question: 'I found "neonwatty/bugdrop" on GitHub. Should I clone this repository?',
      },
    },
  ],
  suggestedOrder: ['task-1'],
  sessionId: 'test-session-123',
  needsClarification: true,
  summary: {
    totalTasks: 1,
    routableCount: 0,
    needsClarificationCount: 1,
    estimatedCost: '$0.0012',
  },
};

export const mockValidatePathResponse = {
  valid: true,
  exists: false,
  parentExists: true,
  expandedPath: '/Users/test/Desktop/bugdrop',
};

export const mockSetupProjectResponse = {
  success: true,
  instanceId: 'instance-123',
  instanceName: 'bugdrop',
  projectId: 'project-123',
  projectPath: '/Users/test/Desktop/bugdrop',
  step: 'complete' as const,
};
