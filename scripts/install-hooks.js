#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');
const SERVER_URL = 'http://localhost:3456';

const ORCHESTRATOR_HOOKS = {
  PreToolUse: [
    {
      matcher: 'Bash|Write|Edit|Read|Glob|Grep',
      hooks: [
        {
          type: 'command',
          command: `curl -sX POST ${SERVER_URL}/api/hooks/status -H 'Content-Type: application/json' -d '{"event":"working","projectDir":"'"$CLAUDE_PROJECT_DIR"'"}' > /dev/null 2>&1 || true`,
          timeout: 5,
        },
      ],
    },
  ],
  PostToolUse: [
    {
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: `curl -sX POST ${SERVER_URL}/api/hooks/status -H 'Content-Type: application/json' -d '{"event":"idle","projectDir":"'"$CLAUDE_PROJECT_DIR"'"}' > /dev/null 2>&1 || true`,
          timeout: 5,
        },
      ],
    },
  ],
  Notification: [
    {
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: `curl -sX POST ${SERVER_URL}/api/hooks/notification -H 'Content-Type: application/json' -d '{"event":"awaiting","projectDir":"'"$CLAUDE_PROJECT_DIR"'"}' > /dev/null 2>&1 || true`,
          timeout: 5,
        },
      ],
    },
  ],
  Stop: [
    {
      matcher: '',
      hooks: [
        {
          type: 'command',
          command: `curl -sX POST ${SERVER_URL}/api/hooks/stop -H 'Content-Type: application/json' -d '{"event":"stopped","projectDir":"'"$CLAUDE_PROJECT_DIR"'"}' > /dev/null 2>&1 || true`,
          timeout: 5,
        },
      ],
    },
  ],
};

// Marker to identify our hooks
const ORCHESTRATOR_MARKER = '# CC-ORCHESTRATOR-HOOK';

function loadSettings() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) {
    console.log('Creating new Claude settings file...');
    return {};
  }

  try {
    const content = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading settings file:', error.message);
    return {};
  }
}

function saveSettings(settings) {
  const dir = path.dirname(CLAUDE_SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function isOrchestratorHook(hook) {
  return hook?.hooks?.some(h =>
    h.command?.includes('localhost:3456') ||
    h.command?.includes(ORCHESTRATOR_MARKER)
  );
}

function mergeHooks(existingHooks = {}, newHooks) {
  const result = { ...existingHooks };

  for (const [eventType, hookConfigs] of Object.entries(newHooks)) {
    // Get existing hooks for this event type
    const existing = result[eventType] || [];

    // Filter out any existing orchestrator hooks
    const filtered = existing.filter(config => !isOrchestratorHook(config));

    // Add our new hooks
    result[eventType] = [...filtered, ...hookConfigs];
  }

  return result;
}

function installHooks() {
  console.log('Installing CC Orchestrator hooks...\n');

  const settings = loadSettings();

  // Merge our hooks with existing ones
  settings.hooks = mergeHooks(settings.hooks, ORCHESTRATOR_HOOKS);

  saveSettings(settings);

  console.log('✅ Hooks installed successfully!\n');
  console.log('The following hooks have been added:');
  console.log('  - PreToolUse: Detects when Claude starts using tools (working status)');
  console.log('  - PostToolUse: Detects when Claude finishes tool use (idle status)');
  console.log('  - Notification: Detects when Claude awaits input');
  console.log('  - Stop: Detects when Claude stops\n');
  console.log(`Hooks will send status updates to: ${SERVER_URL}\n`);
  console.log('Note: Make sure the CC Orchestrator server is running for hooks to work.');
}

installHooks();
