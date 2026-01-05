/**
 * SSH Sync Frame Integration Tests
 *
 * These tests connect to a real SSH server to verify sync frame buffering
 * works under real network conditions (TCP packet fragmentation).
 *
 * Configuration via environment variables:
 *   SSH_TEST_HOST - Remote SSH host (required)
 *   SSH_TEST_USER - SSH username (default: current user)
 *   SSH_TEST_PORT - SSH port (default: 22)
 *   SSH_TEST_KEY_PATH - Path to SSH private key (required)
 *
 * Example:
 *   SSH_TEST_HOST=192.168.1.19 SSH_TEST_USER=neonwatty SSH_TEST_KEY_PATH=~/.ssh/id_ed25519 \
 *     npm run test -- ssh-sync-integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import os from 'os';
import { SSHBackend } from '../services/backends/ssh.backend.js';

// Environment configuration
const SSH_HOST = process.env.SSH_TEST_HOST;
const SSH_USER = process.env.SSH_TEST_USER || os.userInfo().username;
const SSH_PORT = parseInt(process.env.SSH_TEST_PORT || '22', 10);
const SSH_KEY_PATH = process.env.SSH_TEST_KEY_PATH?.replace(/^~/, os.homedir());

// Skip if not configured
const canRunIntegration = Boolean(SSH_HOST && SSH_KEY_PATH);

if (!canRunIntegration) {
  console.log('SSH integration tests skipped: Set SSH_TEST_HOST and SSH_TEST_KEY_PATH to enable');
}

/**
 * Detect if any emissions have unbalanced sync frame markers.
 * If the buffering is working correctly, every emission should have
 * equal numbers of start and end markers.
 */
function detectSplitFrames(emissions: string[]): {
  hasBug: boolean;
  details: string[];
  stats: { total: number; withMarkers: number; unbalanced: number };
} {
  const details: string[] = [];
  let hasBug = false;
  let withMarkers = 0;
  let unbalanced = 0;

  for (let i = 0; i < emissions.length; i++) {
    // eslint-disable-next-line no-control-regex
    const starts = (emissions[i].match(/\x1b\[\?2026h/g) || []).length;
    // eslint-disable-next-line no-control-regex
    const ends = (emissions[i].match(/\x1b\[\?2026l/g) || []).length;

    if (starts > 0 || ends > 0) {
      withMarkers++;
    }

    if (starts !== ends) {
      hasBug = true;
      unbalanced++;
      details.push(
        `Emission ${i}: ${starts} starts, ${ends} ends. ` +
        `Length: ${emissions[i].length}. ` +
        `Preview: ${JSON.stringify(emissions[i].slice(0, 80))}`
      );
    }
  }

  return {
    hasBug,
    details,
    stats: { total: emissions.length, withMarkers, unbalanced },
  };
}

/**
 * Wait for a specific string to appear in emissions
 */
async function waitForOutput(
  emissions: string[],
  searchString: string,
  timeoutMs: number = 10000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const allOutput = emissions.join('');
    if (allOutput.includes(searchString)) {
      return true;
    }
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

describe.skipIf(!canRunIntegration)('SSH Sync Frame Integration', () => {
  let backend: SSHBackend;
  let emissions: string[];

  beforeAll(async () => {
    console.log(`Connecting to ${SSH_USER}@${SSH_HOST}:${SSH_PORT}...`);

    backend = new SSHBackend('integration-test', {
      host: SSH_HOST!,
      port: SSH_PORT,
      username: SSH_USER,
      privateKeyPath: SSH_KEY_PATH,
    });

    emissions = [];
    backend.on('data', (_id: string, data: string) => {
      emissions.push(data);
    });

    await backend.spawn({
      workingDir: '~',
      cols: 120,
      rows: 40,
    });

    // Wait for shell to be ready
    await new Promise(r => setTimeout(r, 1000));
    console.log('SSH connection established');
  }, 30000);

  afterAll(async () => {
    if (backend) {
      await backend.kill();
      console.log('SSH connection closed');
    }
  });

  beforeEach(() => {
    emissions = [];
  });

  it('should execute a simple command and receive output', async () => {
    // Verify the shell works by running a simple echo command
    backend.write('echo "TEST_OUTPUT_12345"\n');
    const found = await waitForOutput(emissions, 'TEST_OUTPUT_12345', 5000);
    expect(found).toBe(true);
  });

  it('should handle simulated sync frame output from shell script', async () => {
    // Run a shell script that outputs sync frames like Claude Code does
    const script = `for i in $(seq 1 10); do printf '\\033[?2026h  Thinking %d/10\\033[?2026l' $i; sleep 0.05; done; echo ""; echo "SCRIPT_DONE"`;
    backend.write(script + '\n');

    const found = await waitForOutput(emissions, 'SCRIPT_DONE', 15000);
    expect(found).toBe(true);

    const result = detectSplitFrames(emissions);

    console.log('Emission stats:', result.stats);
    if (result.hasBug) {
      console.error('BUG DETECTED - Split sync frames:');
      result.details.forEach(d => console.error('  ', d));
    }

    expect(result.hasBug).toBe(false);
  }, 20000);

  it('should handle rapid sync frames without splitting', async () => {
    // Faster output to stress test the buffering
    const script = `for i in $(seq 1 50); do printf '\\033[?2026h\\033[2K\\033[G  Frame %02d\\033[?2026l' $i; done; echo ""; echo "RAPID_DONE"`;
    backend.write(script + '\n');

    const found = await waitForOutput(emissions, 'RAPID_DONE', 15000);
    expect(found).toBe(true);

    const result = detectSplitFrames(emissions);

    console.log('Rapid test emission stats:', result.stats);
    if (result.hasBug) {
      console.error('BUG DETECTED in rapid test - Split sync frames:');
      result.details.slice(0, 5).forEach(d => console.error('  ', d));
      if (result.details.length > 5) {
        console.error(`  ... and ${result.details.length - 5} more`);
      }
    }

    expect(result.hasBug).toBe(false);
  }, 20000);

  it('should handle sync frames with cursor movement (like spinner)', async () => {
    // More realistic Claude Code spinner simulation
    const script = `
      frames="⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏"
      for frame in $frames; do
        printf '\\033[?2026h\\033[2K\\033[G  %s Thinking...\\033[?2026l' "$frame"
        sleep 0.08
      done
      echo ""
      echo "SPINNER_DONE"
    `;
    backend.write(script + '\n');

    const found = await waitForOutput(emissions, 'SPINNER_DONE', 15000);
    expect(found).toBe(true);

    const result = detectSplitFrames(emissions);

    console.log('Spinner test emission stats:', result.stats);
    if (result.hasBug) {
      console.error('BUG DETECTED in spinner test:');
      result.details.forEach(d => console.error('  ', d));
    }

    expect(result.hasBug).toBe(false);
  }, 20000);

  it('should handle mixed content with sync frames', async () => {
    const script = `
      echo "Before sync"
      printf '\\033[?2026hSync content 1\\033[?2026l'
      echo ""
      echo "Middle text"
      printf '\\033[?2026hSync content 2\\033[?2026l'
      echo ""
      echo "MIXED_DONE"
    `;
    backend.write(script + '\n');

    const found = await waitForOutput(emissions, 'MIXED_DONE', 10000);
    expect(found).toBe(true);

    const result = detectSplitFrames(emissions);

    if (result.hasBug) {
      console.error('BUG DETECTED in mixed content test:');
      result.details.forEach(d => console.error('  ', d));
    }

    expect(result.hasBug).toBe(false);
  }, 15000);

  it('should handle real Claude Code thinking animation', async () => {
    // Run actual Claude Code with a simple prompt that triggers thinking
    // Using --print to get output without interactive mode
    const prompt = 'What is 2+2? Answer with just the number.';
    backend.write(`claude -p "${prompt}" --print 2>&1\n`);

    // Wait for Claude to complete (may take a while for thinking)
    const found = await waitForOutput(emissions, '4', 120000);

    // Log all emissions for debugging
    const allOutput = emissions.join('');
    console.log('Claude output length:', allOutput.length);
    console.log('Contains sync markers:', allOutput.includes('\x1b[?2026'));

    const result = detectSplitFrames(emissions);

    console.log('Claude Code test emission stats:', result.stats);
    if (result.hasBug) {
      console.error('BUG DETECTED in Claude Code test - Split sync frames:');
      result.details.slice(0, 10).forEach(d => console.error('  ', d));
      if (result.details.length > 10) {
        console.error(`  ... and ${result.details.length - 10} more`);
      }
    }

    // The test passes if Claude completed AND no split frames detected
    expect(found).toBe(true);
    expect(result.hasBug).toBe(false);
  }, 180000); // 3 minute timeout for Claude

  it('should handle Claude Code with longer thinking (tool use)', async () => {
    // A prompt that requires more thinking/tool use to stress test
    const prompt = 'List the files in the current directory using ls';
    backend.write(`claude -p "${prompt}" --print 2>&1\n`);

    // Wait for completion - look for shell prompt return or common output
    // Using a longer timeout since this involves tool execution
    await new Promise(r => setTimeout(r, 30000)); // Wait 30s for Claude to work

    const result = detectSplitFrames(emissions);

    console.log('Claude Code tool use test stats:', result.stats);
    if (result.hasBug) {
      console.error('BUG DETECTED in Claude tool use test:');
      result.details.slice(0, 10).forEach(d => console.error('  ', d));
    }

    // Even if Claude doesn't complete, check for split frames in what we captured
    if (result.stats.withMarkers > 0) {
      expect(result.hasBug).toBe(false);
    }
  }, 60000);
});

// Standalone test for the detection function
describe('detectSplitFrames helper', () => {
  it('should detect unbalanced sync markers (the bug)', () => {
    const buggyEmissions = [
      '\x1b[?2026h  Thinking...', // Has start, no end
      ' more content',
      '\x1b[?2026l', // Has end, no start
    ];

    const result = detectSplitFrames(buggyEmissions);
    expect(result.hasBug).toBe(true);
    expect(result.stats.unbalanced).toBe(2);
  });

  it('should pass for balanced sync markers (fix working)', () => {
    const goodEmissions = [
      '\x1b[?2026h  Thinking...\x1b[?2026l',
      'regular output',
      '\x1b[?2026h  Done!\x1b[?2026l',
    ];

    const result = detectSplitFrames(goodEmissions);
    expect(result.hasBug).toBe(false);
    expect(result.stats.unbalanced).toBe(0);
    expect(result.stats.withMarkers).toBe(2);
  });

  it('should handle emissions without any sync markers', () => {
    const noMarkers = ['hello', 'world', 'test'];
    const result = detectSplitFrames(noMarkers);
    expect(result.hasBug).toBe(false);
    expect(result.stats.withMarkers).toBe(0);
  });
});
