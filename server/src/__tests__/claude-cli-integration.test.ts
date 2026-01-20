/**
 * Claude CLI Integration Tests
 *
 * These tests verify the actual Claude CLI integration works correctly.
 * They require:
 * - Claude CLI installed (`claude` command available)
 * - Valid ANTHROPIC_API_KEY environment variable
 *
 * Run manually with: npm run test:claude-cli
 * Run in CI with: ANTHROPIC_API_KEY=... npm run test:claude-cli
 *
 * IMPORTANT: These tests cost money (API calls) and are slow.
 * They are NOT run as part of the standard test suite.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { checkClaudeCliAvailable } from '../services/claude-cli.service.js';

// Skip these tests unless explicitly enabled
const CLAUDE_CLI_TESTS_ENABLED = process.env.ENABLE_CLAUDE_CLI_TESTS === 'true';

describe.skipIf(!CLAUDE_CLI_TESTS_ENABLED)('Claude CLI Integration', () => {
  beforeAll(async () => {
    // Verify Claude CLI is available
    const available = await checkClaudeCliAvailable();
    if (!available) {
      throw new Error(
        'Claude CLI is not available. Install with: npm install -g @anthropic-ai/claude-code'
      );
    }

    // Verify API key is set
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for Claude CLI tests');
    }
  });

  describe('checkClaudeCliAvailable', () => {
    it('should detect Claude CLI is installed', async () => {
      const available = await checkClaudeCliAvailable();
      expect(available).toBe(true);
    });
  });

  // These tests are commented out to prevent accidental API charges
  // Uncomment when you want to run full integration tests

  /*
  describe('parseTasks', () => {
    it('should parse a simple task', async () => {
      const { parseTasks } = await import('../services/claude-cli.service.js');

      const result = await parseTasks(
        'Fix the login bug in the auth module',
        'Projects: test-app (id: proj-1, path: /app/test-app)'
      );

      expect(result.success).toBe(true);
      expect(result.data.tasks).toHaveLength(1);
      expect(result.data.tasks[0].type).toBe('bug');
      expect(result.cost).toBeGreaterThan(0);
    }, 30000); // 30s timeout for API call

    it('should parse multiple tasks', async () => {
      const { parseTasks } = await import('../services/claude-cli.service.js');

      const result = await parseTasks(
        'Add dark mode to settings, then fix the navbar dropdown, and update the README',
        'Projects: test-app (id: proj-1, path: /app/test-app)'
      );

      expect(result.success).toBe(true);
      expect(result.data.tasks.length).toBeGreaterThanOrEqual(2);
    }, 30000);

    it('should ask for clarification on ambiguous project', async () => {
      const { parseTasks } = await import('../services/claude-cli.service.js');

      const result = await parseTasks(
        'Fix the thing in that project', // Intentionally vague
        '' // No context
      );

      expect(result.success).toBe(true);
      expect(result.data.tasks.some(t => t.clarificationNeeded)).toBe(true);
    }, 30000);
  });

  describe('clarifyTasks', () => {
    it('should update tasks after clarification', async () => {
      const { parseTasks, clarifyTasks } = await import('../services/claude-cli.service.js');

      // First parse (should need clarification)
      const parseResult = await parseTasks(
        'Fix the bug',
        'Projects: app-a (id: 1), app-b (id: 2)'
      );

      expect(parseResult.success).toBe(true);

      // Provide clarification
      const clarifyResult = await clarifyTasks(
        parseResult.sessionId,
        'The bug is in app-a'
      );

      expect(clarifyResult.success).toBe(true);
      expect(clarifyResult.data.tasks[0].projectId).toBe('1');
    }, 60000); // 60s for two API calls
  });
  */
});

/**
 * Test utilities for mocking Claude CLI responses in other tests
 */
export const mockClaudeCliResponses = {
  simpleTask: {
    success: true,
    data: {
      tasks: [
        {
          id: 'task-1',
          originalText: 'Fix the login bug',
          title: 'Fix login bug',
          type: 'bug' as const,
          projectId: 'proj-1',
          projectConfidence: 0.95,
          clarity: 'clear' as const,
        },
      ],
      suggestedOrder: ['task-1'],
    },
    sessionId: 'mock-session-1',
    cost: 0.001,
  },

  ambiguousTask: {
    success: true,
    data: {
      tasks: [
        {
          id: 'task-1',
          originalText: 'Fix the thing',
          title: 'Fix the thing',
          type: 'other' as const,
          projectId: null,
          projectConfidence: 0,
          clarity: 'ambiguous' as const,
          clarificationNeeded: {
            question: 'Which project is this task for?',
          },
        },
      ],
      suggestedOrder: ['task-1'],
    },
    sessionId: 'mock-session-2',
    cost: 0.001,
  },

  githubRepoDetected: {
    success: true,
    data: {
      tasks: [
        {
          id: 'task-1',
          originalText: 'Work on bugdrop',
          title: 'Work on bugdrop project',
          type: 'feature' as const,
          projectId: null,
          projectConfidence: 0,
          clarity: 'unknown_project' as const,
          clarificationNeeded: {
            question:
              'I found "neonwatty/bugdrop" on GitHub. Should I clone this repository to work on it?',
          },
        },
      ],
      suggestedOrder: ['task-1'],
    },
    sessionId: 'mock-session-3',
    cost: 0.0015,
  },
};
