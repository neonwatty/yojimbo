import { randomUUID } from 'crypto';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import type { Project } from '@cc-orchestrator/shared';

interface ProjectRow {
  id: string;
  name: string;
  path: string;
  git_remote: string | null;
  repo_name: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    gitRemote: row.git_remote,
    repoName: row.repo_name,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new project in the registry
 */
export function createProject(data: {
  name: string;
  path: string;
  gitRemote?: string;
  repoName?: string;
}): Project {
  const db = getDatabase();
  const id = randomUUID();

  db.prepare(`
    INSERT INTO projects (id, name, path, git_remote, repo_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, data.name, data.path, data.gitRemote ?? null, data.repoName ?? null);

  const project: Project = {
    id,
    name: data.name,
    path: data.path,
    gitRemote: data.gitRemote ?? null,
    repoName: data.repoName ?? null,
    lastActivityAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  broadcast({ type: 'project:created', project } as any);
  console.log(`📁 Project registered: ${data.name} at ${data.path}`);

  return project;
}

/**
 * Get a project by ID
 */
export function getProject(id: string): Project | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

/**
 * Get a project by path (unique)
 */
export function getProjectByPath(path: string): Project | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM projects WHERE path = ?').get(path) as ProjectRow | undefined;
  return row ? rowToProject(row) : null;
}

/**
 * List all projects
 */
export function listProjects(): Project[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM projects
    ORDER BY last_activity_at DESC NULLS LAST, name ASC
  `).all() as ProjectRow[];
  return rows.map(rowToProject);
}

/**
 * Update a project
 */
export function updateProject(
  id: string,
  updates: { name?: string; gitRemote?: string; repoName?: string }
): Project | null {
  const db = getDatabase();

  const updateFields: string[] = [];
  const values: (string | null)[] = [];

  if (updates.name !== undefined) {
    updateFields.push('name = ?');
    values.push(updates.name);
  }

  if (updates.gitRemote !== undefined) {
    updateFields.push('git_remote = ?');
    values.push(updates.gitRemote);
  }

  if (updates.repoName !== undefined) {
    updateFields.push('repo_name = ?');
    values.push(updates.repoName);
  }

  if (updateFields.length === 0) {
    return getProject(id);
  }

  updateFields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`
    UPDATE projects
    SET ${updateFields.join(', ')}
    WHERE id = ?
  `).run(...values);

  const project = getProject(id);
  if (project) {
    broadcast({ type: 'project:updated', project } as any);
  }

  return project;
}

/**
 * Delete a project
 */
export function deleteProject(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);

  if (result.changes > 0) {
    broadcast({ type: 'project:deleted', projectId: id } as any);
    return true;
  }

  return false;
}

/**
 * Update last activity timestamp for a project
 */
export function touchProjectActivity(id: string): void {
  const db = getDatabase();
  db.prepare(`
    UPDATE projects
    SET last_activity_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(id);
}

/**
 * Associate an instance with a project
 */
export function linkInstanceToProject(projectId: string, instanceId: string): void {
  const db = getDatabase();

  // Use INSERT OR IGNORE to handle duplicates gracefully
  db.prepare(`
    INSERT OR IGNORE INTO project_instances (project_id, instance_id)
    VALUES (?, ?)
  `).run(projectId, instanceId);

  // Update project activity
  touchProjectActivity(projectId);
}

/**
 * Remove instance-project association
 */
export function unlinkInstanceFromProject(projectId: string, instanceId: string): void {
  const db = getDatabase();
  db.prepare(`
    DELETE FROM project_instances
    WHERE project_id = ? AND instance_id = ?
  `).run(projectId, instanceId);
}

/**
 * Get all instances associated with a project
 */
export function getProjectInstances(projectId: string): string[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT instance_id FROM project_instances
    WHERE project_id = ?
  `).all(projectId) as { instance_id: string }[];
  return rows.map(r => r.instance_id);
}

/**
 * Get project for an instance (via its working directory)
 */
export function getProjectForInstance(instanceId: string): Project | null {
  const db = getDatabase();

  // First try the junction table
  const linkedProject = db.prepare(`
    SELECT p.* FROM projects p
    JOIN project_instances pi ON pi.project_id = p.id
    WHERE pi.instance_id = ?
    ORDER BY p.last_activity_at DESC
    LIMIT 1
  `).get(instanceId) as ProjectRow | undefined;

  if (linkedProject) {
    return rowToProject(linkedProject);
  }

  // Fall back to matching by working directory
  const byPath = db.prepare(`
    SELECT p.* FROM projects p
    JOIN instances i ON i.working_dir = p.path
    WHERE i.id = ?
  `).get(instanceId) as ProjectRow | undefined;

  return byPath ? rowToProject(byPath) : null;
}

/**
 * Ensure a project exists for a given path, creating it if needed.
 * This is called when an instance opens a directory.
 */
export function ensureProjectExists(
  path: string,
  name?: string,
  gitInfo?: { remote?: string; repoName?: string }
): Project {
  // Check if project already exists for this path
  let project = getProjectByPath(path);

  if (project) {
    // Update git info if provided and different
    if (gitInfo && (gitInfo.remote !== project.gitRemote || gitInfo.repoName !== project.repoName)) {
      updateProject(project.id, {
        gitRemote: gitInfo.remote,
        repoName: gitInfo.repoName,
      });
      project = getProject(project.id)!;
    }
    return project;
  }

  // Create new project
  const projectName = name || path.split('/').pop() || 'Unknown';
  return createProject({
    name: projectName,
    path,
    gitRemote: gitInfo?.remote,
    repoName: gitInfo?.repoName,
  });
}
