import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Smart Tasks Setup E2E Tests
 *
 * These tests verify the clone & create instance flow works correctly.
 * They use real git operations and create actual instances.
 *
 * Test repos used:
 * - https://github.com/octocat/Hello-World (small, stable public repo)
 *
 * Cleanup:
 * - Tests clean up cloned directories after each test
 * - Tests clean up created instances via API
 */

// Test configuration
const TEST_REPO_URL = 'https://github.com/octocat/Hello-World.git';
const TEST_REPO_NAME = 'octocat/Hello-World';
const API_BASE = 'http://localhost:3456/api';

// Helper to generate unique test directory
function getTestDir(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return path.join(os.tmpdir(), `yojimbo-e2e-${timestamp}-${random}`);
}

// Helper to clean up directory
async function cleanupDir(dirPath: string): Promise<void> {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// Helper to delete instance via API
async function deleteInstance(request: any, instanceId: string): Promise<void> {
  try {
    await request.delete(`${API_BASE}/instances/${instanceId}`);
  } catch {
    // Ignore cleanup errors
  }
}

// Helper to delete project via API
async function deleteProject(request: any, projectId: string): Promise<void> {
  try {
    await request.delete(`${API_BASE}/projects/${projectId}`);
  } catch {
    // Ignore cleanup errors
  }
}

test.describe('Smart Tasks Setup API', () => {
  test.describe('Path Validation Endpoint', () => {
    test('validates non-existent path with existing parent', async ({ request }) => {
      const testPath = getTestDir();

      const response = await request.post(`${API_BASE}/smart-tasks/validate-path`, {
        data: { path: testPath },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.valid).toBe(true);
      expect(data.data.exists).toBe(false);
      expect(data.data.parentExists).toBe(true);
      expect(data.data.expandedPath).toBe(testPath);
    });

    test('rejects existing directory', async ({ request }) => {
      // Use a directory that definitely exists
      const existingPath = os.tmpdir();

      const response = await request.post(`${API_BASE}/smart-tasks/validate-path`, {
        data: { path: existingPath },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.valid).toBe(false);
      expect(data.data.exists).toBe(true);
      expect(data.data.error).toContain('already exists');
    });

    test('rejects path with non-existent parent', async ({ request }) => {
      const badPath = '/nonexistent/parent/directory/test';

      const response = await request.post(`${API_BASE}/smart-tasks/validate-path`, {
        data: { path: badPath },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.valid).toBe(false);
      expect(data.data.parentExists).toBe(false);
    });

    test('expands ~ to home directory', async ({ request }) => {
      const response = await request.post(`${API_BASE}/smart-tasks/validate-path`, {
        data: { path: '~/test-nonexistent-dir-12345' },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.expandedPath).toBe(path.join(os.homedir(), 'test-nonexistent-dir-12345'));
    });
  });

  test.describe('Expand Path Endpoint', () => {
    test('expands ~ to home directory', async ({ request }) => {
      const response = await request.post(`${API_BASE}/smart-tasks/expand-path`, {
        data: { path: '~/Desktop' },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.expandedPath).toBe(path.join(os.homedir(), 'Desktop'));
    });
  });

  test.describe('Setup Project Endpoint', () => {
    // Note: These tests are slower as they perform real git operations
    test.setTimeout(60000); // 60s timeout for clone operations

    let createdInstanceId: string | null = null;
    let createdProjectId: string | null = null;
    let testDir: string | null = null;

    test.beforeEach(() => {
      testDir = getTestDir();
    });

    test.afterEach(async ({ request }) => {
      // Clean up instance if created
      if (createdInstanceId) {
        await deleteInstance(request, createdInstanceId);
        createdInstanceId = null;
      }

      // Clean up project if created
      if (createdProjectId) {
        await deleteProject(request, createdProjectId);
        createdProjectId = null;
      }

      // Clean up cloned directory
      if (testDir) {
        await cleanupDir(testDir);
        testDir = null;
      }
    });

    test('returns error for missing sessionId', async ({ request }) => {
      const response = await request.post(`${API_BASE}/smart-tasks/setup-project`, {
        data: {
          action: 'clone-and-create',
          gitRepoUrl: TEST_REPO_URL,
          targetPath: testDir,
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('sessionId');
    });

    test('returns error for missing gitRepoUrl', async ({ request }) => {
      const response = await request.post(`${API_BASE}/smart-tasks/setup-project`, {
        data: {
          sessionId: 'test-session',
          action: 'clone-and-create',
          targetPath: testDir,
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('gitRepoUrl');
    });

    test('returns error for invalid session', async ({ request }) => {
      const response = await request.post(`${API_BASE}/smart-tasks/setup-project`, {
        data: {
          sessionId: 'nonexistent-session-id',
          action: 'clone-and-create',
          gitRepoUrl: TEST_REPO_URL,
          targetPath: testDir,
        },
      });

      expect(response.status()).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Session not found');
    });

    // Full integration test - requires creating a real session first
    test.skip('clones repo, creates instance, and registers project', async ({ request }) => {
      // This test requires a valid session from smart-tasks/parse
      // which requires Claude CLI. Skip unless explicitly enabled.

      // First, create a session by parsing a task
      const parseResponse = await request.post(`${API_BASE}/smart-tasks/parse`, {
        data: { input: 'Test task for Hello-World repo' },
      });

      if (!parseResponse.ok()) {
        test.skip(true, 'Claude CLI not available for session creation');
        return;
      }

      const parseData = await parseResponse.json();
      const sessionId = parseData.data.sessionId;

      // Now setup the project
      const setupResponse = await request.post(`${API_BASE}/smart-tasks/setup-project`, {
        data: {
          sessionId,
          action: 'clone-and-create',
          gitRepoUrl: TEST_REPO_URL,
          targetPath: testDir,
          instanceName: 'e2e-test-instance',
        },
      });

      expect(setupResponse.ok()).toBe(true);
      const setupData = await setupResponse.json();

      expect(setupData.success).toBe(true);
      expect(setupData.data.instanceId).toBeDefined();
      expect(setupData.data.projectId).toBeDefined();
      expect(setupData.data.projectPath).toBe(testDir);

      // Save IDs for cleanup
      createdInstanceId = setupData.data.instanceId;
      createdProjectId = setupData.data.projectId;

      // Verify the directory was created and contains a git repo
      const gitDir = path.join(testDir!, '.git');
      expect(fs.existsSync(gitDir)).toBe(true);

      // Verify instance exists via API
      const instanceResponse = await request.get(
        `${API_BASE}/instances/${createdInstanceId}`
      );
      expect(instanceResponse.ok()).toBe(true);
      const instanceData = await instanceResponse.json();
      expect(instanceData.data.name).toBe('e2e-test-instance');
      expect(instanceData.data.workingDir).toBe(testDir);
    });
  });
});

test.describe('Git Clone Service (via API)', () => {
  // Test the git clone functionality indirectly through the setup-project endpoint
  // These are more targeted tests for edge cases

  test('rejects clone to existing directory', async ({ request }) => {
    // Create a temp directory first
    const existingDir = getTestDir();
    await fs.promises.mkdir(existingDir, { recursive: true });

    try {
      const response = await request.post(`${API_BASE}/smart-tasks/validate-path`, {
        data: { path: existingDir },
      });

      const data = await response.json();
      expect(data.data.valid).toBe(false);
      expect(data.data.exists).toBe(true);
    } finally {
      await cleanupDir(existingDir);
    }
  });
});
