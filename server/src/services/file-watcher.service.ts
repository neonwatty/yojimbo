import chokidar, { FSWatcher } from 'chokidar';
import * as path from 'path';
import * as crypto from 'crypto';
import { broadcast } from '../websocket/server.js';
import type { FileChangeEvent, WSServerMessage } from '@cc-orchestrator/shared';

interface WatchedDirectory {
  watcher: FSWatcher;
  workingDir: string;
  fileType: 'note' | 'plan';
}

// Track active watchers by working directory + type
const watchers = new Map<string, WatchedDirectory>();

// Debounce timers for file changes
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Get a unique key for a watcher
function getWatcherKey(workingDir: string, fileType: 'note' | 'plan'): string {
  return `${workingDir}:${fileType}`;
}

// Generate a stable file ID from the path
function generateFileId(filePath: string): string {
  return crypto.createHash('md5').update(filePath).digest('hex').slice(0, 12);
}

// Debounce file change events
function debounceFileChange(filePath: string, callback: () => void, delay = 100): void {
  const existingTimer = debounceTimers.get(filePath);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    debounceTimers.delete(filePath);
    callback();
  }, delay);

  debounceTimers.set(filePath, timer);
}

// Start watching a directory for notes or plans
export function startWatching(workingDir: string, fileType: 'note' | 'plan'): void {
  const key = getWatcherKey(workingDir, fileType);

  // Already watching this directory
  if (watchers.has(key)) {
    return;
  }

  const dirName = fileType === 'note' ? 'notes' : 'plans';
  const watchPath = path.join(workingDir, dirName);

  console.log(`👁️ Starting file watcher for ${watchPath}`);

  const watcher = chokidar.watch(`${watchPath}/**/*.md`, {
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on('change', (filePath) => {
    debounceFileChange(filePath, () => {
      const fileChange: FileChangeEvent = {
        fileType,
        fileId: generateFileId(filePath),
        filePath,
        workingDir,
        changeType: 'modified',
        timestamp: new Date().toISOString(),
      };

      console.log(`📝 File changed: ${filePath}`);

      const message: WSServerMessage = {
        type: 'file:changed',
        fileChange,
      };

      broadcast(message);
    });
  });

  watcher.on('unlink', (filePath) => {
    const fileChange: FileChangeEvent = {
      fileType,
      fileId: generateFileId(filePath),
      filePath,
      workingDir,
      changeType: 'deleted',
      timestamp: new Date().toISOString(),
    };

    console.log(`🗑️ File deleted: ${filePath}`);

    const message: WSServerMessage = {
      type: 'file:deleted',
      fileChange,
    };

    broadcast(message);
  });

  watcher.on('error', (error) => {
    console.error(`File watcher error for ${watchPath}:`, error);
  });

  watchers.set(key, { watcher, workingDir, fileType });
}

// Stop watching a specific directory
export function stopWatching(workingDir: string, fileType: 'note' | 'plan'): void {
  const key = getWatcherKey(workingDir, fileType);
  const watchedDir = watchers.get(key);

  if (watchedDir) {
    console.log(`👁️ Stopping file watcher for ${workingDir}/${fileType}s`);
    watchedDir.watcher.close();
    watchers.delete(key);
  }
}

// Stop all watchers
export function stopAllWatchers(): void {
  console.log('👁️ Stopping all file watchers');
  for (const [key, watchedDir] of watchers) {
    watchedDir.watcher.close();
    watchers.delete(key);
  }

  // Clear any pending debounce timers
  for (const timer of debounceTimers.values()) {
    clearTimeout(timer);
  }
  debounceTimers.clear();
}

// Check if a directory is being watched
export function isWatching(workingDir: string, fileType: 'note' | 'plan'): boolean {
  return watchers.has(getWatcherKey(workingDir, fileType));
}
