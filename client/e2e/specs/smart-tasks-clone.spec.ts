import { test, expect, Page } from '@playwright/test';

/**
 * Smart Todos Clone & Create Flow E2E Tests
 *
 * Tests the clone and create instance flow including:
 * - Clone modal opening for unknown projects
 * - Path validation UI feedback
 * - Setup progress indicators
 * - Success and error states
 */

// Mock availability response
const mockSmartTodosStatus = {
  success: true,
  data: {
    available: true,
    message: 'Smart Todos is ready',
  },
};

// Mock parsed todos with unknown project (needs clone)
const mockParsedTodosWithUnknownProject = {
  success: true,
  data: {
    sessionId: 'test-session-clone-123',
    todos: [
      {
        id: 'todo-1',
        originalText: 'Fix bug in bugdrop',
        title: 'Fix bug in bugdrop',
        type: 'bug',
        projectId: null,
        projectConfidence: 0,
        projectMatches: [],
        clarity: 'unknown_project',
        clarificationNeeded: {
          question: 'I found "neonwatty/bugdrop" on GitHub. Should I clone this repository?',
        },
      },
    ],
    suggestedOrder: ['todo-1'],
    needsClarification: true,
    summary: {
      totalTodos: 1,
      routableCount: 0,
      needsClarificationCount: 1,
      estimatedCost: '$0.0012',
    },
  },
};

// Mock parsed todos with all known projects (no clone needed)
const mockParsedTodosAllKnown = {
  success: true,
  data: {
    sessionId: 'test-session-known-123',
    todos: [
      {
        id: 'todo-1',
        originalText: 'Check PRs on bugdrop',
        title: 'Check open pull requests',
        type: 'other',
        projectId: 'proj-bugdrop',
        projectConfidence: 0.95,
        projectMatches: [
          { projectId: 'proj-bugdrop', confidence: 0.95, reason: 'exact match' },
        ],
        clarity: 'clear',
      },
    ],
    suggestedOrder: ['todo-1'],
    needsClarification: false,
    summary: {
      totalTodos: 1,
      routableCount: 1,
      needsClarificationCount: 0,
      estimatedCost: '$0.0010',
    },
  },
};

// Mock projects data
const mockProjects = {
  success: true,
  data: [
    { id: 'proj-bugdrop', name: 'bugdrop', path: '/Users/test/bugdrop' },
    { id: 'proj-yojimbo', name: 'yojimbo', path: '/Users/test/yojimbo' },
  ],
};

// Mock path validation responses
const mockValidPathResponse = {
  success: true,
  data: {
    valid: true,
    exists: false,
    parentExists: true,
    expandedPath: '/Users/test/Desktop/bugdrop',
  },
};

const mockExistingPathResponse = {
  success: true,
  data: {
    valid: false,
    exists: true,
    parentExists: true,
    expandedPath: '/Users/test/Desktop/existing-repo',
  },
};

const mockInvalidParentPathResponse = {
  success: true,
  data: {
    valid: false,
    exists: false,
    parentExists: false,
    expandedPath: '/Users/test/nonexistent/repo',
  },
};

// Mock setup project response (success)
const mockSetupProjectSuccess = {
  success: true,
  data: {
    success: true,
    instanceId: 'instance-123',
    instanceName: 'bugdrop',
    projectId: 'project-123',
    projectPath: '/Users/test/Desktop/bugdrop',
    step: 'complete',
  },
};

// Mock setup project response (error)
const mockSetupProjectError = {
  success: false,
  error: 'Failed to clone repository: Repository not found',
};

// Helper to set up all Smart Todos API mocks
async function setupSmartTodosMocks(
  page: Page,
  options: {
    parseResponse?: typeof mockParsedTodosWithUnknownProject;
    pathValidationResponse?: typeof mockValidPathResponse;
    setupResponse?: typeof mockSetupProjectSuccess;
  } = {}
) {
  const {
    parseResponse = mockParsedTodosWithUnknownProject,
    pathValidationResponse = mockValidPathResponse,
    setupResponse = mockSetupProjectSuccess,
  } = options;

  // Mock availability check
  await page.route(/\/api\/smart-todos\/status/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSmartTodosStatus),
    });
  });

  // Mock projects API
  await page.route(/\/api\/projects$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProjects),
    });
  });

  // Mock parse API
  await page.route(/\/api\/smart-todos\/parse/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(parseResponse),
    });
  });

  // Mock path validation
  await page.route(/\/api\/smart-todos\/validate-path/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pathValidationResponse),
    });
  });

  // Mock setup project
  await page.route(/\/api\/smart-todos\/setup-project/, async (route) => {
    // Add a small delay to simulate the setup process
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
      status: setupResponse.success ? 200 : 400,
      contentType: 'application/json',
      body: JSON.stringify(setupResponse),
    });
  });
}

// Helper to navigate to parsed todos review
async function navigateToParsedTodosReview(page: Page, inputText = 'Fix bug in bugdrop') {
  await page.goto('/');
  await page.locator('button:has-text("Todos")').click();
  await page.locator('button:has-text("Smart")').click();
  // Wait for Smart Todo Input modal to be visible
  await expect(page.locator('h2:has-text("Smart Todo Input")')).toBeVisible();
  // Use a more specific selector for the Smart Todo textarea (the placeholder text is unique)
  const smartTodoTextarea = page.locator('textarea[placeholder*="Fix the auth bug"]');
  await smartTodoTextarea.fill(inputText);
  await page.locator('button:has-text("Parse Todos")').click();
  await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();
}

test.describe('Smart Todos Clone & Create Flow', () => {
  test.describe('Clone Setup Modal', () => {
    test('should not show clone button when no todos need cloning', async ({ page }) => {
      await setupSmartTodosMocks(page, { parseResponse: mockParsedTodosAllKnown });
      await navigateToParsedTodosReview(page, 'Check PRs on bugdrop');

      // Clone button should NOT be visible when all projects are known
      await expect(page.locator('button:has-text("Clone")')).not.toBeVisible();

      // Ready badge should be visible instead (use exact match to avoid "ready to route")
      await expect(page.getByText('Ready', { exact: true })).toBeVisible();
    });

    test('should show clone modal when clicking Clone & Create button', async ({ page }) => {
      await setupSmartTodosMocks(page);
      await navigateToParsedTodosReview(page);

      // Click the clone button
      await page.locator('button:has-text("Clone")').click();

      // Modal should be visible (it's an h3)
      await expect(page.locator('h3:has-text("Clone & Create Instance")')).toBeVisible();
      await expect(page.locator('text=Repository URL')).toBeVisible();
      await expect(page.locator('text=Clone to')).toBeVisible();
      await expect(page.locator('text=Instance name')).toBeVisible();
    });

    test('should close clone modal when clicking cancel', async ({ page }) => {
      await setupSmartTodosMocks(page);
      await navigateToParsedTodosReview(page);

      // Open clone modal
      await page.locator('button:has-text("Clone")').click();
      await expect(page.locator('h3:has-text("Clone & Create Instance")')).toBeVisible();

      // Click cancel
      await page.locator('button:has-text("Cancel")').click();

      // Modal should be closed
      await expect(page.locator('h3:has-text("Clone & Create Instance")')).not.toBeVisible();
    });

    test('should auto-populate instance name from GitHub URL', async ({ page }) => {
      await setupSmartTodosMocks(page);
      await navigateToParsedTodosReview(page);

      // Open clone modal
      await page.locator('button:has-text("Clone")').click();
      await expect(page.locator('h3:has-text("Clone & Create Instance")')).toBeVisible();

      // Enter a GitHub URL in the first input field
      const urlInput = page.locator('input').first();
      await urlInput.fill('https://github.com/neonwatty/bugdrop');

      // Wait for auto-population
      await page.waitForTimeout(300);

      // Instance name should be auto-populated with repo name
      await expect(page.locator('input[value="bugdrop"]')).toBeVisible();
    });

    test('should support SSH URLs', async ({ page }) => {
      await setupSmartTodosMocks(page);
      await navigateToParsedTodosReview(page);

      // Open clone modal
      await page.locator('button:has-text("Clone")').click();
      await expect(page.locator('h3:has-text("Clone & Create Instance")')).toBeVisible();

      // Enter an SSH URL
      const urlInput = page.locator('input').first();
      await urlInput.fill('git@github.com:neonwatty/bugdrop.git');

      // Wait for auto-population
      await page.waitForTimeout(300);

      // Instance name should be extracted from SSH URL
      await expect(page.locator('input[value="bugdrop"]')).toBeVisible();
    });
  });

  test.describe('Path Validation UI', () => {
    test('should show green checkmark for valid new path', async ({ page }) => {
      await setupSmartTodosMocks(page, { pathValidationResponse: mockValidPathResponse });
      await navigateToParsedTodosReview(page);

      // Open clone modal
      await page.locator('button:has-text("Clone")').click();

      // Fill in URL to trigger path population
      const urlInput = page.locator('input').first();
      await urlInput.fill('https://github.com/neonwatty/bugdrop');

      // Wait for validation
      await page.waitForTimeout(500);

      // Should show success indicator (checkmark and "Path is valid" message)
      await expect(page.locator('text=Path is valid')).toBeVisible();

      // The Clone & Create Instance button should be enabled
      await expect(page.locator('button:has-text("Clone & Create Instance")')).toBeEnabled();
    });

    test('should show warning for existing directory', async ({ page }) => {
      await setupSmartTodosMocks(page, { pathValidationResponse: mockExistingPathResponse });
      await navigateToParsedTodosReview(page);

      // Open clone modal
      await page.locator('button:has-text("Clone")').click();

      // Fill in URL
      const urlInput = page.locator('input').first();
      await urlInput.fill('https://github.com/test/existing-repo');

      // Wait for validation
      await page.waitForTimeout(500);

      // Should show warning about existing directory (text includes emoji)
      await expect(page.locator('text=Directory already exists')).toBeVisible();
    });

    test('should show error for missing parent directory', async ({ page }) => {
      await setupSmartTodosMocks(page, { pathValidationResponse: mockInvalidParentPathResponse });
      await navigateToParsedTodosReview(page);

      // Open clone modal
      await page.locator('button:has-text("Clone")').click();

      // Fill in URL
      const urlInput = page.locator('input').first();
      await urlInput.fill('https://github.com/test/repo');

      // Wait for validation
      await page.waitForTimeout(500);

      // Should show error about parent directory (text includes emoji)
      await expect(page.locator('text=Parent directory does not exist')).toBeVisible();
    });
  });

  test.describe('Setup Progress', () => {
    test('should show progress or completion when setup runs', async ({ page }) => {
      // Add a longer delay to the mock to catch progress state
      await page.route(/\/api\/smart-todos\/status/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSmartTodosStatus),
        });
      });
      await page.route(/\/api\/projects$/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProjects),
        });
      });
      await page.route(/\/api\/smart-todos\/parse/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockParsedTodosWithUnknownProject),
        });
      });
      await page.route(/\/api\/smart-todos\/validate-path/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockValidPathResponse),
        });
      });
      // Longer delay to catch progress state
      await page.route(/\/api\/smart-todos\/setup-project/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSetupProjectSuccess),
        });
      });

      await navigateToParsedTodosReview(page);

      // Open clone modal
      await page.locator('button:has-text("Clone")').click();

      // Fill in URL
      const urlInput = page.locator('input').first();
      await urlInput.fill('https://github.com/neonwatty/bugdrop');

      // Wait for fields to populate and validation to complete
      await page.waitForTimeout(500);

      // Start the clone process
      const setupButton = page.locator('button:has-text("Clone & Create Instance")');
      await setupButton.click();

      // Should show progress state or eventually complete
      // Due to timing, we may catch progress or completion
      await expect(
        page.locator('text=Setting up')
          .or(page.locator('text=Starting clone'))
          .or(page.locator('text=Setup Complete'))
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show success state on completion', async ({ page }) => {
      await setupSmartTodosMocks(page, { setupResponse: mockSetupProjectSuccess });
      await navigateToParsedTodosReview(page);

      // Open clone modal - URL is auto-detected from clarification question
      await page.locator('button:has-text("Clone")').click();
      await expect(page.locator('h3:has-text("Clone & Create Instance")')).toBeVisible();

      // The URL should already be populated from the detected GitHub repo
      // Just wait for path validation to complete
      await page.waitForTimeout(500);

      // Start setup - the button text is "Clone & Create Instance"
      const setupButton = page.locator('button:has-text("Clone & Create Instance")');
      await setupButton.click();

      // Wait for completion - use expect with timeout instead of fixed wait
      // Use the specific heading text to avoid matching toast messages
      await expect(page.locator('h4:has-text("Setup Complete")')).toBeVisible({ timeout: 5000 });

      // Open Instance button should be visible
      await expect(page.locator('button:has-text("Open Instance")')).toBeVisible();
    });

    test('should show error state on failure', async ({ page }) => {
      await setupSmartTodosMocks(page, { setupResponse: mockSetupProjectError });
      await navigateToParsedTodosReview(page);

      // Open clone modal - URL is auto-detected from clarification question
      await page.locator('button:has-text("Clone")').click();
      await expect(page.locator('h3:has-text("Clone & Create Instance")')).toBeVisible();

      // Wait for path validation to complete
      await page.waitForTimeout(500);

      // Start setup
      const setupButton = page.locator('button:has-text("Clone & Create Instance")');
      await setupButton.click();

      // Wait for error - use expect with timeout
      await expect(page.locator('text=Setup Failed')).toBeVisible({ timeout: 5000 });

      // Try Again button should be visible
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
    });
  });

  test.describe('Unknown Project Indicator', () => {
    test('should show Unknown project badge for todos needing clone', async ({ page }) => {
      await setupSmartTodosMocks(page);
      await navigateToParsedTodosReview(page);

      // Should show Unknown project badge
      await expect(page.locator('text=Unknown project')).toBeVisible();
    });

    test('should show clarification question for unknown projects', async ({ page }) => {
      await setupSmartTodosMocks(page);
      await navigateToParsedTodosReview(page);

      // Should show the clarification question from the parse response
      await expect(page.locator('text=Should I clone')).toBeVisible();
    });

    test('should show todo count with clarification needed', async ({ page }) => {
      await setupSmartTodosMocks(page);
      await navigateToParsedTodosReview(page);

      // Should show summary indicating clarification needed
      await expect(page.locator('text=1 needs clarification').or(page.locator('text=needs clarification'))).toBeVisible();
    });
  });
});
