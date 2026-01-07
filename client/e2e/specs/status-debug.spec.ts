import { test, expect } from '../fixtures/test-fixtures';
import { WebSocket } from 'ws';
import { StatusAnalyzer, StatusLogEvent } from '../utils/status-analyzer';

/**
 * Status Detection Debug Tests
 *
 * These tests run real Claude Code instances and monitor status changes
 * via WebSocket to detect conflicts between the three parallel detection
 * mechanisms: hooks, local file polling, and status timeout.
 *
 * Prerequisites:
 * - Claude Code CLI installed (`claude` command available)
 * - API key configured
 * - Hooks installed (`make hooks-install`)
 *
 * Run with: npm run test:e2e:status-debug
 * Or: TEST_CLAUDE_INTEGRATION=1 npx playwright test --grep "Status Debug"
 */

const API_BASE = 'http://localhost:3456/api';
const WS_URL = 'ws://localhost:3456/ws';

// Test configuration
const TEST_CONFIG = {
  taskPrompts: [
    'list the files in the current directory using ls',
    'show the contents of package.json using cat',
    'list the files in the current directory',
  ],
  testTimeout: 180000, // 3 minutes
  statusWaitTimeout: 60000, // 1 minute per status wait
};

// Helper to get the status badge
const statusBadge = (page: any, status: string) =>
  page.locator('span.inline-flex').filter({ hasText: status });

/**
 * Enhanced StatusTracker that captures all WebSocket messages
 * including status changes and log:status diagnostic logs
 */
class EnhancedStatusTracker {
  private ws: WebSocket | null = null;
  private statusHistory: Map<string, string[]> = new Map();
  private connected = false;
  private analyzer: StatusAnalyzer;

  constructor(testName: string) {
    this.analyzer = new StatusAnalyzer(testName);
  }

  async connect(): Promise<void> {
    this.analyzer.start();

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.on('open', () => {
        this.connected = true;
        resolve();
      });

      this.ws.on('error', (err) => {
        reject(err);
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          // Track status changes
          if (msg.type === 'status:changed' && msg.instanceId) {
            const history = this.statusHistory.get(msg.instanceId) || [];
            history.push(msg.status);
            this.statusHistory.set(msg.instanceId, history);
          }

          // Capture diagnostic logs
          if (msg.type === 'log:status') {
            this.analyzer.addLog(msg as StatusLogEvent);
          }
        } catch {
          // ignore parse errors
        }
      });
    });
  }

  sawStatus(instanceId: string, status: string): boolean {
    const history = this.statusHistory.get(instanceId) || [];
    return history.includes(status);
  }

  getStatusHistory(instanceId: string): string[] {
    return this.statusHistory.get(instanceId) || [];
  }

  async waitForStatus(instanceId: string, status: string, timeout = 30000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.sawStatus(instanceId, status)) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  getAnalyzer(): StatusAnalyzer {
    return this.analyzer;
  }

  generateReport(): string {
    const report = this.analyzer.generateReport();
    return this.analyzer.formatReport(report);
  }

  hasConflicts(): boolean {
    return this.analyzer.hasConflicts();
  }

  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Skip these tests unless explicitly enabled
const describeOrSkip = process.env.TEST_CLAUDE_INTEGRATION
  ? test.describe
  : test.describe.skip;

describeOrSkip('Status Debug', () => {
  test.setTimeout(TEST_CONFIG.testTimeout);

  test.beforeEach(async ({ apiClient }) => {
    await apiClient.cleanupAllInstances();
  });

  test('single instance - multi-step task', async ({ instancesPage }) => {
    // Connect to WebSocket BEFORE creating instance
    const tracker = new EnhancedStatusTracker('Single Instance Multi-Step Task');
    await tracker.connect();

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();

      // Wait for expanded view with terminal
      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
      const url = instancesPage.page.url();
      const instanceId = url.split('/').pop()!;

      console.log(`\n📊 Test instance ID: ${instanceId}`);

      await instancesPage.page.waitForTimeout(2000);

      // Should start as idle
      await expect(statusBadge(instancesPage.page, 'Idle')).toBeVisible({ timeout: 10000 });

      // Focus terminal and run claude with a multi-step prompt
      const terminal = instancesPage.page.locator('.xterm-screen');
      await terminal.click();

      // Use a prompt that requires multiple tool uses
      const prompt = TEST_CONFIG.taskPrompts[0];
      console.log(`📊 Sending prompt: ${prompt}`);

      await instancesPage.page.keyboard.type(`claude -p "${prompt}"`);
      await instancesPage.page.keyboard.press('Enter');

      // Wait for working status
      const sawWorking = await tracker.waitForStatus(instanceId, 'working', TEST_CONFIG.statusWaitTimeout);
      console.log(`📊 Saw working status: ${sawWorking}`);

      if (sawWorking) {
        // Wait for task to complete (back to idle)
        await tracker.waitForStatus(instanceId, 'idle', TEST_CONFIG.statusWaitTimeout);
      }

      // Give time for final state to settle
      await instancesPage.page.waitForTimeout(2000);

      // Set expected final status
      tracker.getAnalyzer().setExpectedFinalStatus(instanceId, 'idle');

      // Generate and log the report
      const report = tracker.generateReport();
      console.log('\n' + report);

      // Check for conflicts
      const hasConflicts = tracker.hasConflicts();
      if (hasConflicts) {
        console.warn('⚠️ Status conflicts detected! See report above.');
      }

      // The test passes if we saw working status
      expect(sawWorking).toBe(true);

      // Optionally fail on conflicts (can be changed based on debug needs)
      // expect(hasConflicts).toBe(false);
    } finally {
      tracker.close();
    }
  });

  test.skip('multiple instances in parallel', async ({ instancesPage, apiClient }) => {
    // TODO: Fix navigation to instance detail pages - terminal not becoming visible
    // Connect to WebSocket BEFORE creating instances
    const tracker = new EnhancedStatusTracker('Multiple Instances Parallel');
    await tracker.connect();

    const instanceIds: string[] = [];

    try {
      // Create 3 instances via API
      for (let i = 0; i < 3; i++) {
        const response = await fetch(`${API_BASE}/instances`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: `Test Instance ${i + 1}`,
            workingDir: '~',
          }),
        });
        const data = await response.json();
        if (data.data?.id) {
          instanceIds.push(data.data.id);
          console.log(`📊 Created instance ${i + 1}: ${data.data.id}`);
        }
      }

      expect(instanceIds.length).toBe(3);

      // Wait for instances to initialize
      await instancesPage.page.waitForTimeout(3000);

      // Navigate to first instance and send commands via terminal
      await instancesPage.gotoInstances();

      for (let i = 0; i < instanceIds.length; i++) {
        const instanceId = instanceIds[i];

        // Navigate to instance
        await instancesPage.page.goto(`http://localhost:5173/instances/${instanceId}`);
        await instancesPage.page.waitForTimeout(1000);

        // Focus terminal - use first() since page may show multiple terminals
        const terminal = instancesPage.page.locator('.xterm-screen').first();
        await terminal.click();

        // Send a simple command that uses Claude
        const prompt = TEST_CONFIG.taskPrompts[i % TEST_CONFIG.taskPrompts.length];
        console.log(`📊 Instance ${i + 1}: Sending prompt: ${prompt}`);

        await instancesPage.page.keyboard.type(`claude -p "${prompt}"`);
        await instancesPage.page.keyboard.press('Enter');

        // Don't wait for completion - move to next instance
        await instancesPage.page.waitForTimeout(500);
      }

      // Now wait for all to complete
      console.log('📊 Waiting for all instances to complete...');

      for (const instanceId of instanceIds) {
        // Wait for working then idle
        await tracker.waitForStatus(instanceId, 'working', TEST_CONFIG.statusWaitTimeout);
        await tracker.waitForStatus(instanceId, 'idle', TEST_CONFIG.statusWaitTimeout);
        tracker.getAnalyzer().setExpectedFinalStatus(instanceId, 'idle');
      }

      // Give time for final state
      await instancesPage.page.waitForTimeout(2000);

      // Generate and log the report
      const report = tracker.generateReport();
      console.log('\n' + report);

      // Check for conflicts
      const hasConflicts = tracker.hasConflicts();
      if (hasConflicts) {
        console.warn('⚠️ Status conflicts detected! See report above.');
      }

      // Verify we saw activity on all instances
      for (const instanceId of instanceIds) {
        const history = tracker.getStatusHistory(instanceId);
        console.log(`📊 Instance ${instanceId.slice(0, 8)} history: ${history.join(' → ')}`);
        expect(history.length).toBeGreaterThan(0);
      }
    } finally {
      tracker.close();

      // Cleanup instances
      for (const id of instanceIds) {
        await apiClient.closeInstance(id).catch(() => {});
      }
    }
  });

  test('rapid commands stress test', async ({ instancesPage }) => {
    // Connect to WebSocket BEFORE creating instance
    const tracker = new EnhancedStatusTracker('Rapid Commands Stress Test');
    await tracker.connect();

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();

      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
      const url = instancesPage.page.url();
      const instanceId = url.split('/').pop()!;

      console.log(`\n📊 Test instance ID: ${instanceId}`);

      await instancesPage.page.waitForTimeout(2000);

      const terminal = instancesPage.page.locator('.xterm-screen');
      await terminal.click();

      // Start claude in interactive mode
      await instancesPage.page.keyboard.type('claude');
      await instancesPage.page.keyboard.press('Enter');

      // Wait for Claude to initialize
      await instancesPage.page.waitForTimeout(5000);

      // Send multiple rapid commands
      const commands = [
        'ls',
        'pwd',
        'echo "test"',
      ];

      for (const cmd of commands) {
        console.log(`📊 Sending command: ${cmd}`);
        await instancesPage.page.keyboard.type(cmd);
        await instancesPage.page.keyboard.press('Enter');

        // Short wait between commands to stress test
        await instancesPage.page.waitForTimeout(1000);
      }

      // Wait for final status to settle
      await instancesPage.page.waitForTimeout(10000);

      // Exit claude
      await instancesPage.page.keyboard.type('/exit');
      await instancesPage.page.keyboard.press('Enter');
      await instancesPage.page.waitForTimeout(2000);

      // Set expected final status
      tracker.getAnalyzer().setExpectedFinalStatus(instanceId, 'idle');

      // Generate and log the report
      const report = tracker.generateReport();
      console.log('\n' + report);

      const statusHistory = tracker.getStatusHistory(instanceId);
      console.log(`📊 Final status history: ${statusHistory.join(' → ')}`);

      // Check for conflicts
      const hasConflicts = tracker.hasConflicts();
      const conflictCount = tracker.getAnalyzer().getConflictCount();
      console.log(`📊 Conflicts detected: ${conflictCount}`);

      if (hasConflicts) {
        console.warn('⚠️ Status conflicts detected! See report above.');
      }

      // We expect some status changes happened
      expect(statusHistory.length).toBeGreaterThan(0);
    } finally {
      tracker.close();
    }
  });

  test('hook verification - manual trigger', async ({ instancesPage }) => {
    // This test manually triggers hooks to verify the logging system works
    const tracker = new EnhancedStatusTracker('Hook Verification');
    await tracker.connect();

    try {
      await instancesPage.gotoInstances();
      await instancesPage.createNewInstance();

      await expect(instancesPage.page).toHaveURL(/.*\/instances\/[a-zA-Z0-9-]+$/);
      const url = instancesPage.page.url();
      const instanceId = url.split('/').pop()!;

      // Get instance details
      const response = await fetch(`${API_BASE}/instances`);
      const data = await response.json();
      const instance = data.data?.find((i: any) => i.id === instanceId);

      expect(instance).toBeDefined();
      console.log(`\n📊 Instance: ${instance.name} (${instanceId})`);
      console.log(`📊 Working dir: ${instance.workingDir}`);

      // Trigger hooks manually to test the logging system
      console.log('📊 Triggering working hook...');
      await fetch(`${API_BASE}/hooks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'working', projectDir: instance.workingDir, instanceId }),
      });

      await instancesPage.page.waitForTimeout(1000);

      console.log('📊 Triggering stop hook...');
      await fetch(`${API_BASE}/hooks/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDir: instance.workingDir, instanceId }),
      });

      await instancesPage.page.waitForTimeout(1000);

      // Trigger another working/stop cycle
      console.log('📊 Triggering second working hook...');
      await fetch(`${API_BASE}/hooks/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'working', projectDir: instance.workingDir, instanceId }),
      });

      await instancesPage.page.waitForTimeout(500);

      console.log('📊 Triggering notification hook...');
      await fetch(`${API_BASE}/hooks/notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDir: instance.workingDir, instanceId }),
      });

      await instancesPage.page.waitForTimeout(1000);

      // Set expected final status
      tracker.getAnalyzer().setExpectedFinalStatus(instanceId, 'idle');

      // Generate and log the report
      const report = tracker.generateReport();
      console.log('\n' + report);

      // Verify we captured the status changes
      const history = tracker.getStatusHistory(instanceId);
      console.log(`📊 Status history: ${history.join(' → ')}`);

      expect(history).toContain('working');
      expect(history).toContain('idle');

      // Verify logs were captured
      const logs = tracker.getAnalyzer().getLogs();
      console.log(`📊 Total log events captured: ${logs.length}`);
      expect(logs.length).toBeGreaterThan(0);
    } finally {
      tracker.close();
    }
  });
});
