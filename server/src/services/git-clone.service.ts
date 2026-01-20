import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

export interface CloneResult {
  success: boolean;
  path: string;
  error?: string;
  repoName?: string;
  gitRemote?: string;
}

/**
 * Expand ~ to home directory and resolve relative paths
 */
export function expandPath(targetPath: string): string {
  if (targetPath.startsWith('~')) {
    return path.join(homedir(), targetPath.slice(1));
  }
  return path.resolve(targetPath);
}

/**
 * Extract repo name from a git URL
 */
export function extractRepoName(repoUrl: string): string {
  // Handle SSH URLs like git@github.com:owner/repo.git
  // Handle HTTPS URLs like https://github.com/owner/repo.git
  const match = repoUrl.match(/[/:]([^/]+\/[^/]+?)(\.git)?$/);
  if (match) {
    return match[1]; // owner/repo
  }
  // Fallback: extract just the last part
  const parts = repoUrl.split('/');
  let name = parts[parts.length - 1];
  if (name.endsWith('.git')) {
    name = name.slice(0, -4);
  }
  return name;
}

/**
 * Clone a git repository to a target path
 *
 * @param repoUrl - Git repository URL (SSH or HTTPS)
 * @param targetPath - Local path to clone to (supports ~ expansion)
 * @returns Clone result with success status and details
 */
export async function cloneRepository(
  repoUrl: string,
  targetPath: string
): Promise<CloneResult> {
  const expandedPath = expandPath(targetPath);

  // Validate target path doesn't already exist
  if (existsSync(expandedPath)) {
    return {
      success: false,
      path: expandedPath,
      error: `Directory already exists: ${expandedPath}`,
    };
  }

  // Validate parent directory exists
  const parentDir = path.dirname(expandedPath);
  if (!existsSync(parentDir)) {
    return {
      success: false,
      path: expandedPath,
      error: `Parent directory does not exist: ${parentDir}`,
    };
  }

  return new Promise((resolve) => {
    const gitProcess = spawn('git', ['clone', repoUrl, expandedPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    gitProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    gitProcess.on('close', (code) => {
      if (code === 0) {
        const repoName = extractRepoName(repoUrl);
        resolve({
          success: true,
          path: expandedPath,
          repoName,
          gitRemote: repoUrl,
        });
      } else {
        resolve({
          success: false,
          path: expandedPath,
          error: stderr.trim() || `git clone exited with code ${code}`,
        });
      }
    });

    gitProcess.on('error', (err) => {
      resolve({
        success: false,
        path: expandedPath,
        error: `Failed to execute git: ${err.message}`,
      });
    });
  });
}

export interface PathValidationResult {
  valid: boolean;
  exists: boolean;
  parentExists: boolean;
  expandedPath: string;
  error?: string;
}

/**
 * Validate a path for cloning
 *
 * @param targetPath - Path to validate (supports ~ expansion)
 * @returns Validation result with details
 */
export function validateClonePath(targetPath: string): PathValidationResult {
  if (!targetPath || targetPath.trim() === '') {
    return {
      valid: false,
      exists: false,
      parentExists: false,
      expandedPath: '',
      error: 'Path is required',
    };
  }

  const expandedPath = expandPath(targetPath.trim());
  const parentDir = path.dirname(expandedPath);

  const exists = existsSync(expandedPath);
  const parentExists = existsSync(parentDir);

  // Valid if: doesn't exist yet, but parent does exist
  const valid = !exists && parentExists;

  return {
    valid,
    exists,
    parentExists,
    expandedPath,
    error: exists
      ? 'Directory already exists'
      : !parentExists
        ? 'Parent directory does not exist'
        : undefined,
  };
}
