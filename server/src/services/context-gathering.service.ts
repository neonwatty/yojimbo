import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDatabase } from '../db/connection.js';
import { listProjects, getProjectForInstance } from './projects.service.js';
import type {
  InstanceContext,
  GitStateContext,
  ProjectContext,
} from '@cc-orchestrator/shared';

const execAsync = promisify(exec);

interface InstanceRow {
  id: string;
  name: string;
  working_dir: string;
  status: string;
}

/**
 * Expand ~ to home directory
 */
function expandPath(p: string): string {
  return p.replace(/^~/, os.homedir());
}

/**
 * Compress path for response (use ~ for home)
 */
function compressPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? p.replace(home, '~') : p;
}

/**
 * Get status of all running (non-closed) instances
 */
export function getInstanceStatus(): { instances: InstanceContext[] } {
  const db = getDatabase();

  const instances = db.prepare(`
    SELECT i.id, i.name, i.working_dir, i.status
    FROM instances i
    WHERE i.closed_at IS NULL
    ORDER BY i.display_order
  `).all() as InstanceRow[];

  return {
    instances: instances.map(i => {
      const project = getProjectForInstance(i.id);
      return {
        id: i.id,
        name: i.name,
        dir: compressPath(i.working_dir),
        status: (i.status === 'working' ? 'working' : 'idle') as 'working' | 'idle',
        projectId: project?.id,
      };
    }),
  };
}

/**
 * Get git state for a project directory
 */
export async function getGitState(
  projectPath: string
): Promise<GitStateContext | { error: string }> {
  const workingDir = expandPath(projectPath);

  // Verify directory exists
  if (!fs.existsSync(workingDir)) {
    return { error: `Directory not found: ${projectPath}` };
  }

  try {
    // Get current branch
    const { stdout: branchOut } = await execAsync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: workingDir }
    );
    const branch = branchOut.trim();

    // Get recent commits (last 5)
    const { stdout: logOut } = await execAsync(
      'git log -5 --format="%h|%s|%ar" 2>/dev/null || echo ""',
      { cwd: workingDir }
    );
    const commits = logOut.trim().split('\n')
      .filter(line => line)
      .map(line => {
        const [hash, msg, age] = line.split('|');
        return {
          hash,
          msg: msg.length > 80 ? msg.slice(0, 77) + '...' : msg,
          age,
        };
      });

    // Check for uncommitted changes
    const { stdout: statusOut } = await execAsync(
      'git status --porcelain',
      { cwd: workingDir }
    );
    const dirty = statusOut.trim().length > 0;

    // Check ahead/behind (may fail if no upstream)
    let ahead: number | undefined;
    let behind: number | undefined;
    try {
      const { stdout: abOut } = await execAsync(
        'git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null',
        { cwd: workingDir }
      );
      const [behindStr, aheadStr] = abOut.trim().split(/\s+/);
      ahead = parseInt(aheadStr, 10) || undefined;
      behind = parseInt(behindStr, 10) || undefined;
    } catch {
      // No upstream configured, that's fine
    }

    return { branch, commits, dirty, ahead, behind };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { error: `Git command failed: ${msg}` };
  }
}

/**
 * Get git remote info for a directory
 */
export async function getGitRemoteInfo(
  projectPath: string
): Promise<{ remote: string; repoName: string } | null> {
  const workingDir = expandPath(projectPath);

  if (!fs.existsSync(workingDir)) {
    return null;
  }

  try {
    const { stdout } = await execAsync(
      'git config --get remote.origin.url 2>/dev/null || echo ""',
      { cwd: workingDir }
    );
    const remoteUrl = stdout.trim();

    if (!remoteUrl) {
      return null;
    }

    // Parse repo name from various URL formats
    // git@github.com:user/repo.git
    // https://github.com/user/repo.git
    let repoName: string | null = null;

    if (remoteUrl.includes(':') && remoteUrl.includes('@')) {
      // SSH format: git@github.com:user/repo.git
      const match = remoteUrl.match(/:([^/]+\/[^.]+)/);
      repoName = match ? match[1] : null;
    } else {
      // HTTPS format: https://github.com/user/repo.git
      const match = remoteUrl.match(/\/([^/]+\/[^/.]+)(?:\.git)?$/);
      repoName = match ? match[1] : null;
    }

    return repoName ? { remote: remoteUrl, repoName } : null;
  } catch {
    return null;
  }
}

/**
 * Get README content for a project
 */
export async function getReadmeContent(
  projectPath: string,
  maxChars: number = 2000
): Promise<{ content: string | null; truncated: boolean; path: string } | { error: string }> {
  const workingDir = expandPath(projectPath);

  if (!fs.existsSync(workingDir)) {
    return { error: `Directory not found: ${projectPath}` };
  }

  // Check common README locations
  const readmeNames = ['README.md', 'readme.md', 'README', 'readme.txt'];
  let readmePath: string | null = null;

  for (const name of readmeNames) {
    const candidate = path.join(workingDir, name);
    if (fs.existsSync(candidate)) {
      readmePath = candidate;
      break;
    }
  }

  if (!readmePath) {
    return {
      content: null,
      truncated: false,
      path: path.join(workingDir, 'README.md'),
    };
  }

  try {
    const content = fs.readFileSync(readmePath, 'utf-8');
    const truncated = content.length > maxChars;

    return {
      content: truncated ? content.slice(0, maxChars) : content,
      truncated,
      path: readmePath,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { error: `Failed to read README: ${msg}` };
  }
}

/**
 * Gather full context for task parsing.
 * This pre-loads all context needed by the Claude CLI.
 */
export async function gatherFullContext(): Promise<{
  projects: ProjectContext[];
  instances: InstanceContext[];
}> {
  // Get all projects
  const projects = listProjects();

  // Get instance status
  const { instances } = getInstanceStatus();

  // Enrich projects with git state
  const enrichedProjects: ProjectContext[] = await Promise.all(
    projects.map(async (project) => {
      const gitState = await getGitState(project.path);
      return {
        id: project.id,
        name: project.name,
        path: compressPath(project.path),
        repoName: project.repoName,
        gitState: 'error' in gitState ? undefined : gitState,
      };
    })
  );

  return {
    projects: enrichedProjects,
    instances,
  };
}

/**
 * Format context as a string for the Claude CLI prompt
 */
export function formatContextForPrompt(context: {
  projects: ProjectContext[];
  instances: InstanceContext[];
}): string {
  const lines: string[] = [];

  lines.push('## Available Projects\n');
  if (context.projects.length === 0) {
    lines.push('No projects registered yet.\n');
  } else {
    for (const project of context.projects) {
      lines.push(`### ${project.name}`);
      lines.push(`- ID: ${project.id}`);
      lines.push(`- Path: ${project.path}`);
      if (project.repoName) {
        lines.push(`- Repo: ${project.repoName}`);
      }
      if (project.gitState) {
        lines.push(`- Branch: ${project.gitState.branch}`);
        if (project.gitState.dirty) {
          lines.push(`- Has uncommitted changes`);
        }
        if (project.gitState.commits.length > 0) {
          lines.push(`- Recent commits:`);
          for (const commit of project.gitState.commits.slice(0, 3)) {
            lines.push(`  - ${commit.hash}: ${commit.msg} (${commit.age})`);
          }
        }
      }
      lines.push('');
    }
  }

  lines.push('## Running Instances\n');
  if (context.instances.length === 0) {
    lines.push('No instances currently running.\n');
  } else {
    for (const instance of context.instances) {
      lines.push(`### ${instance.name}`);
      lines.push(`- ID: ${instance.id}`);
      lines.push(`- Directory: ${instance.dir}`);
      lines.push(`- Status: ${instance.status}`);
      if (instance.projectId) {
        const project = context.projects.find(p => p.id === instance.projectId);
        if (project) {
          lines.push(`- Project: ${project.name}`);
        }
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
