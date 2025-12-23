#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

function loadSettings() {
  if (!fs.existsSync(CLAUDE_SETTINGS_PATH)) {
    console.log('No Claude settings file found.');
    return null;
  }

  try {
    const content = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error reading settings file:', error.message);
    return null;
  }
}

function saveSettings(settings) {
  fs.writeFileSync(CLAUDE_SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function isOrchestratorHook(hook) {
  return hook?.hooks?.some(h =>
    h.command?.includes('localhost:3456') ||
    h.command?.includes('/api/hooks/')
  );
}

function removeOrchestratorHooks(hooks = {}) {
  const result = {};
  let removedCount = 0;

  for (const [eventType, hookConfigs] of Object.entries(hooks)) {
    const filtered = hookConfigs.filter(config => {
      if (isOrchestratorHook(config)) {
        removedCount++;
        return false;
      }
      return true;
    });

    if (filtered.length > 0) {
      result[eventType] = filtered;
    }
  }

  return { hooks: result, removedCount };
}

function uninstallHooks() {
  console.log('Uninstalling CC Orchestrator hooks...\n');

  const settings = loadSettings();

  if (!settings) {
    console.log('Nothing to uninstall.');
    return;
  }

  if (!settings.hooks) {
    console.log('No hooks found in settings.');
    return;
  }

  const { hooks, removedCount } = removeOrchestratorHooks(settings.hooks);
  settings.hooks = hooks;

  if (removedCount === 0) {
    console.log('No CC Orchestrator hooks found.');
    return;
  }

  saveSettings(settings);

  console.log(`✅ Removed ${removedCount} CC Orchestrator hook(s) successfully!`);
}

uninstallHooks();
