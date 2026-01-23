import { test, expect, Page } from '@playwright/test';

/**
 * Smart Todos Project Matching E2E Tests
 *
 * Tests the multi-project matching feature including:
 * - ProjectSelector dropdown showing top 3 matches
 * - Clarity badge display (Ready vs Unknown project)
 * - getEffectiveClarity logic (projectId null = unknown_project)
 * - Clone & Create flow for unknown projects
 */

// Use glob patterns to match API requests regardless of hostname
// The Vite dev server proxies /api/* to the backend

// Mock availability response
const mockSmartTodosStatus = {
  success: true,
  data: {
    available: true,
    message: 'Smart Todos is ready',
  },
};

// Mock parsed todos with multiple project matches
const mockParsedTodosWithMatches = {
  success: true,
  data: {
    sessionId: 'test-session-123',
    todos: [
      {
        id: 'todo-1',
        originalText: 'Check open PRs on bugdrop',
        title: 'Check open pull requests',
        type: 'other',
        projectId: 'proj-bugdrop-1',
        projectConfidence: 0.95,
        projectMatches: [
          { projectId: 'proj-bugdrop-1', confidence: 0.95, reason: 'main branch' },
          { projectId: 'proj-bugdrop-2', confidence: 0.85, reason: 'feature branch' },
          { projectId: 'proj-bugdrop-3', confidence: 0.75, reason: 'worktree' },
        ],
        clarity: 'clear',
      },
      {
        id: 'todo-2',
        originalText: 'Check issues in yojimbo',
        title: 'Check open issues status',
        type: 'other',
        projectId: 'proj-yojimbo',
        projectConfidence: 0.95,
        projectMatches: [
          { projectId: 'proj-yojimbo', confidence: 0.95, reason: 'exact match' },
        ],
        clarity: 'clear',
      },
    ],
    suggestedOrder: ['todo-1', 'todo-2'],
    needsClarification: false,
    summary: {
      totalTodos: 2,
      routableCount: 2,
      needsClarificationCount: 0,
      estimatedCost: '$0.0015',
    },
  },
};

// Mock parsed todos with unknown project
const mockParsedTodosWithUnknownProject = {
  success: true,
  data: {
    sessionId: 'test-session-456',
    todos: [
      {
        id: 'todo-1',
        originalText: 'Fix bug in unknown-repo',
        title: 'Fix bug in unknown-repo',
        type: 'bug',
        projectId: null,
        projectConfidence: 0,
        projectMatches: [],
        clarity: 'unknown_project',
        clarificationNeeded: {
          question: 'I found "unknown-repo" on GitHub. Should I clone this repository?',
        },
      },
      {
        id: 'todo-2',
        originalText: 'Check yojimbo status',
        title: 'Check status',
        type: 'other',
        projectId: 'proj-yojimbo',
        projectConfidence: 0.95,
        projectMatches: [
          { projectId: 'proj-yojimbo', confidence: 0.95, reason: 'exact match' },
        ],
        clarity: 'clear',
      },
    ],
    suggestedOrder: ['todo-1', 'todo-2'],
    needsClarification: true,
    summary: {
      totalTodos: 2,
      routableCount: 1,
      needsClarificationCount: 1,
      estimatedCost: '$0.0012',
    },
  },
};

// Mock projects data
const mockProjects = {
  success: true,
  data: [
    { id: 'proj-bugdrop-1', name: 'bugdrop', path: '/Users/test/bugdrop' },
    { id: 'proj-bugdrop-2', name: 'bugdrop-feature', path: '/Users/test/bugdrop-feature' },
    { id: 'proj-bugdrop-3', name: 'bugdrop-wt', path: '/Users/test/bugdrop-wt' },
    { id: 'proj-yojimbo', name: 'yojimbo', path: '/Users/test/yojimbo' },
  ],
};

// Helper to set up all Smart Todos API mocks
// Uses regex patterns to reliably intercept requests regardless of how URLs are formatted
async function setupSmartTodosMocks(page: Page, parseResponse = mockParsedTodosWithMatches) {
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
    const body = await route.request().postDataJSON();
    const expandedPath = body.path.replace('~', '/Users/test');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          valid: true,
          exists: false,
          parentExists: true,
          expandedPath,
        },
      }),
    });
  });
}

test.describe('Smart Todos Project Matching', () => {
  test.describe('Smart Button Availability', () => {
    test('shows Smart button in Todos modal', async ({ page }) => {
      await page.goto('/');

      // Open Todos modal
      await page.locator('button:has-text("Todos")').click();
      await expect(page.locator('h2:has-text("Global Todos")')).toBeVisible();

      // Smart button should be visible
      await expect(page.locator('button:has-text("Smart")')).toBeVisible();
    });

    test('clicking Smart opens Smart Todo Input modal', async ({ page }) => {
      await setupSmartTodosMocks(page);
      await page.goto('/');

      // Open Todos modal and click Smart
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();

      // Smart Todo Input modal should be visible
      await expect(page.locator('h2:has-text("Smart Todo Input")')).toBeVisible();
      await expect(page.locator('textarea')).toBeVisible();
      await expect(page.locator('button:has-text("Parse Todos")')).toBeVisible();
    });
  });

  test.describe('Parsed Todos Review UI', () => {
    test('shows Ready badge for todos with projectId', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithMatches);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Check open PRs on bugdrop');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait for Review Parsed Todos modal
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();

      // Should show Ready badge (green)
      await expect(page.locator('text=Ready').first()).toBeVisible();

      // Should show project name
      await expect(page.locator('text=bugdrop')).toBeVisible();
    });

    test('shows Unknown project badge for todos without projectId', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithUnknownProject);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Fix bug in unknown-repo');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait for Review Parsed Todos modal
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();

      // Should show Unknown project badge (yellow)
      await expect(page.locator('text=Unknown project')).toBeVisible();

      // Should show clarification question
      await expect(page.locator('text=Should I clone')).toBeVisible();
    });

    test('shows Clone & Create button when todos have unknown projects', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithUnknownProject);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Fix bug in unknown-repo');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait for Review Parsed Todos modal
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();

      // Clone & Create button should be visible
      await expect(page.locator('button:has-text("Clone")')).toBeVisible();
    });

    test('hides Clone & Create button when all todos have known projects', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithMatches);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Check bugdrop PRs');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait for Review Parsed Todos modal
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();

      // Clone & Create button should NOT be visible
      await expect(page.locator('button:has-text("Clone")')).not.toBeVisible();
    });

    test('shows summary with routable and clarification counts', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithUnknownProject);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Test todos');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait for Review Parsed Todos modal
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();

      // Should show todo count summary
      await expect(page.locator('text=2 todos parsed')).toBeVisible();
      await expect(page.locator('text=1 ready to route')).toBeVisible();
      await expect(page.locator('text=1 needs clarification')).toBeVisible();
    });
  });

  test.describe('ProjectSelector Dropdown', () => {
    test('shows project name for todo with multiple matches', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithMatches);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Check bugdrop PRs');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait for Review Parsed Todos modal
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();

      // Should show project name (bugdrop has multiple matches)
      await expect(page.locator('text=bugdrop')).toBeVisible();
    });

    test('shows project name for todo with single match', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithMatches);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Check bugdrop PRs');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait for Review Parsed Todos modal
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();

      // Should show yojimbo (single match) - use specific locator to avoid matching header
      await expect(page.locator('text=Project: yojimbo')).toBeVisible();
    });
  });

  test.describe('Clone & Create Modal', () => {
    test('opens Clone & Create modal when clicking Clone button', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithUnknownProject);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Fix bug in unknown-repo');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait for Review Parsed Todos modal
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();

      // Click Clone & Create button
      await page.locator('button:has-text("Clone")').click();

      // Clone & Create Instance modal should be visible (it's an h3)
      await expect(page.locator('h3:has-text("Clone & Create Instance")')).toBeVisible();
      await expect(page.locator('text=Repository URL')).toBeVisible();
      await expect(page.locator('text=Clone to')).toBeVisible();
      await expect(page.locator('text=Instance name')).toBeVisible();
    });

    test('auto-populates fields when URL is entered', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithUnknownProject);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Fix bug in unknown-repo');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait and click Clone
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();
      await page.locator('button:has-text("Clone")').click();

      // Enter a GitHub URL
      const urlInput = page.locator('input').first();
      await urlInput.fill('https://github.com/octocat/hello-world');

      // Wait for auto-population
      await page.waitForTimeout(500);

      // Clone path should be auto-populated with repo name
      await expect(page.locator('input[value*="hello-world"]')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('Back to input returns to Smart Todo Input', async ({ page }) => {
      await setupSmartTodosMocks(page, mockParsedTodosWithMatches);
      await page.goto('/');

      // Open Smart Todos and parse
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();
      await page.locator('textarea').fill('Check bugdrop PRs');
      await page.locator('button:has-text("Parse Todos")').click();

      // Wait for Review Parsed Todos modal
      await expect(page.locator('h2:has-text("Review Parsed Todos")')).toBeVisible();

      // Click Back to input
      await page.locator('button:has-text("Back to input")').click();

      // Should return to Smart Todo Input
      await expect(page.locator('h2:has-text("Smart Todo Input")')).toBeVisible();

      // Previous input should be preserved
      await expect(page.locator('textarea')).toHaveValue('Check bugdrop PRs');
    });

    test('Escape key closes Smart Todo Input modal', async ({ page }) => {
      await setupSmartTodosMocks(page);
      await page.goto('/');

      // Open Smart Todos
      await page.locator('button:has-text("Todos")').click();
      await page.locator('button:has-text("Smart")').click();

      // Verify modal is open
      await expect(page.locator('h2:has-text("Smart Todo Input")')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Modal should be closed
      await expect(page.locator('h2:has-text("Smart Todo Input")')).not.toBeVisible();
    });
  });
});
