#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function loadSettings() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) {
    console.log('❌ No Claude settings file found at:', CLAUDE_SETTINGS_PATH);
    return null;
  }

  try {
    const content = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('❌ Error reading settings file:', error.message);
    return null;
  }
}

function isOrchestratorHook(hook) {
  return hook?.hooks?.some(h =>
    h.command?.includes('localhost:3456') ||
    h.command?.includes('/api/hooks/')
  );
}

function checkHooks() {
  console.log('Checking CC Orchestrator hooks...\n');

  const settings = loadSettings();

  if (!settings) {
    return;
  }

  if (!settings.hooks) {
    console.log('❌ No hooks configured in Claude settings.\n');
    console.log('Run `make hooks-install` to install CC Orchestrator hooks.');
    return;
  }

  const hookTypes = ['PreToolUse', 'PostToolUse', 'Notification', 'Stop'];
  let installedCount = 0;

  console.log('Hook Status:');
  console.log('============');

  for (const hookType of hookTypes) {
    const hooks = settings.hooks[hookType] || [];
    const hasOrchestratorHook = hooks.some(isOrchestratorHook);

    if (hasOrchestratorHook) {
      console.log(`  ✅ ${hookType}: Installed`);
      installedCount++;
    } else {
      console.log(`  ❌ ${hookType}: Not installed`);
    }
  }

  console.log('');

  if (installedCount === hookTypes.length) {
    console.log('✅ All CC Orchestrator hooks are installed!');
  } else if (installedCount > 0) {
    console.log(`⚠️  Some hooks are missing. Run \`make hooks-install\` to reinstall.`);
  } else {
    console.log('❌ No CC Orchestrator hooks installed.');
    console.log('Run `make hooks-install` to install them.');
  }
}

checkHooks();
