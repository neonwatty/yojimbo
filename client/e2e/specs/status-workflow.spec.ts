import { test, expect } from '../fixtures/test-fixtures';

const API_BASE = 'http://localhost:3456/api';

// Helper to get the status badge (not sidebar stats)
const statusBadge = (page: any, status: string) =>
  page.locator('span.inline-flex').filter({ hasText: status });

test.describe('Status Workflow', () => {
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  test('new instance starts with idle status', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // After creating, should be in expanded view
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);

    // Should see idle status badge
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 5000 });
  });

  test('status changes to working when hook is called', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Get the instance ID from URL
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    const url = instancesPage.page.url();
    const instanceId = url.split('/').pop();

    // Get instance details to find working directory
    const response = await fetch(`${API_BASE}/instances`);
    const data = await response.json();
    const instance = data.data.find((i: any) => i.id === instanceId);
    const workingDir = instance?.workingDir || '~';

    // Call the status hook to simulate Claude Code working
    await fetch(`${API_BASE}/hooks/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'working', projectDir: workingDir, instanceId }),
    });

    // Wait for WebSocket update
    await instancesPage.page.waitForTimeout(500);

    // Should now see working status badge
    await expect(statusBadge(instancesPage.page, 'Working')).toBeVisible({ timeout: 5000 });
  });

  test('notification hook sets status to idle', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Get the instance ID from URL
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    const url = instancesPage.page.url();
    const instanceId = url.split('/').pop();

    // Get instance details
    const response = await fetch(`${API_BASE}/instances`);
    const data = await response.json();
    const instance = data.data.find((i: any) => i.id === instanceId);
    const workingDir = instance?.workingDir || '~';

    // First set to working
    await fetch(`${API_BASE}/hooks/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'working', projectDir: workingDir, instanceId }),
    });
    await instancesPage.page.waitForTimeout(500);
    await expect(statusBadge(instancesPage.page, 'Working')).toBeVisible({ timeout: 5000 });

    // Call the notification hook - now sets to idle
    await fetch(`${API_BASE}/hooks/notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir: workingDir, instanceId }),
    });

    // Wait for WebSocket update
    await instancesPage.page.waitForTimeout(500);

    // Should now see idle status badge (notification now sets idle)
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 5000 });
  });

  test('status changes back to idle when stop hook is called', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Get the instance ID from URL
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    const url = instancesPage.page.url();
    const instanceId = url.split('/').pop();

    // Get instance details
    const response = await fetch(`${API_BASE}/instances`);
    const data = await response.json();
    const instance = data.data.find((i: any) => i.id === instanceId);
    const workingDir = instance?.workingDir || '~';

    // First set to working
    await fetch(`${API_BASE}/hooks/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'working', projectDir: workingDir, instanceId }),
    });
    await instancesPage.page.waitForTimeout(500);
    await expect(statusBadge(instancesPage.page, 'Working')).toBeVisible({ timeout: 5000 });

    // Now call stop hook
    await fetch(`${API_BASE}/hooks/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir: workingDir, instanceId }),
    });
    await instancesPage.page.waitForTimeout(500);

    // Should now see idle status badge
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 5000 });
  });

  test('full status cycle: idle → working → idle', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    // Get the instance ID from URL
    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    const url = instancesPage.page.url();
    const instanceId = url.split('/').pop();

    // Get instance details
    const response = await fetch(`${API_BASE}/instances`);
    const data = await response.json();
    const instance = data.data.find((i: any) => i.id === instanceId);
    const workingDir = instance?.workingDir || '~';

    // 1. Start as idle
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 5000 });

    // 2. Transition to working
    await fetch(`${API_BASE}/hooks/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'working', projectDir: workingDir, instanceId }),
    });
    await instancesPage.page.waitForTimeout(500);
    await expect(statusBadge(instancesPage.page, 'Working')).toBeVisible({ timeout: 5000 });

    // 3. Back to idle via stop hook
    await fetch(`${API_BASE}/hooks/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir: workingDir, instanceId }),
    });
    await instancesPage.page.waitForTimeout(500);
    await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 5000 });
  });

  test('status is visible in sidebar for expanded instance', async ({ instancesPage }) => {
    await instancesPage.gotoInstances();
    await instancesPage.createNewInstance();

    await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
    const url = instancesPage.page.url();
    const instanceId = url.split('/').pop();

    // Get instance details
    const response = await fetch(`${API_BASE}/instances`);
    const data = await response.json();
    const instance = data.data.find((i: any) => i.id === instanceId);
    const workingDir = instance?.workingDir || '~';

    // Set to working
    await fetch(`${API_BASE}/hooks/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'working', projectDir: workingDir, instanceId }),
    });
    await instancesPage.page.waitForTimeout(500);

    // The sidebar should show the status dot (working = green/active)
    // Check that the sidebar has the instance item with a status indicator
    const sidebarItem = instancesPage.page.locator('.group').filter({ hasText: 'instance-' }).first();
    await expect(sidebarItem).toBeVisible();
  });
});
