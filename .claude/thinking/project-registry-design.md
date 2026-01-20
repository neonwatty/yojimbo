# Project Registry Design

## Overview

The Project Registry tracks projects/repos that Claude Code instances work on. Projects are automatically discovered when a Claude Code instance first opens them and persist across sessions for future reference.

## Current Codebase Analysis

### Database Setup
- **Database**: SQLite via `better-sqlite3`
- **Location**: `server/src/db/connection.ts`
- **Pattern**: Schema defined in `initDatabase()`, migrations in `runMigrations()`
- **WAL Mode**: Enabled for better concurrency
- **Foreign Keys**: Enabled

### Instance Storage Pattern
The `instances` table follows this pattern:
- UUID primary key
- snake_case column names in DB
- camelCase in TypeScript types
- `created_at` / `updated_at` timestamps
- Soft delete via `closed_at`
- Row type interface (e.g., `InstanceRow`) converts to API type (e.g., `Instance`)

### Existing Data Model Relationships
- `sessions` -> `instances` (FK, SET NULL on delete)
- `port_forwards` -> `instances` (FK, CASCADE on delete)
- `global_tasks` -> `instances` (FK via `dispatched_instance_id`, SET NULL on delete)
- `instances` -> `remote_machines` (FK via `machine_id`, no constraint - just reference)

---

## Project Schema Design

### Database Table: `projects`

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                    -- Project name (derived from directory or repo)
  directory_path TEXT NOT NULL UNIQUE,   -- Absolute path to project directory
  github_repo TEXT,                      -- GitHub repo in format "owner/repo" (nullable)
  git_remote_url TEXT,                   -- Full git remote URL for reference
  last_activity_at TEXT,                 -- Last time any instance worked on this project
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Junction table for project <-> instance relationship (many-to-many)
CREATE TABLE IF NOT EXISTS project_instances (
  project_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  first_seen_at TEXT DEFAULT (datetime('now')),
  last_seen_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (project_id, instance_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_projects_directory ON projects(directory_path);
CREATE INDEX IF NOT EXISTS idx_projects_github ON projects(github_repo);
CREATE INDEX IF NOT EXISTS idx_projects_activity ON projects(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_instances_project ON project_instances(project_id);
CREATE INDEX IF NOT EXISTS idx_project_instances_instance ON project_instances(instance_id);
```

### Design Decisions

1. **Many-to-Many Relationship**: A project can have multiple instances (different sessions), and an instance can work on multiple projects (if user changes directories).

2. **Unique Directory Path**: Each unique directory path represents one project. If two instances open the same directory, they're working on the same project.

3. **GitHub Repo Extraction**: Optional field - only populated if the directory has a git remote configured.

4. **Timestamps**:
   - `created_at`: When project was first discovered
   - `updated_at`: When project metadata was last modified
   - `last_activity_at`: When any instance last worked on this project (useful for sorting)

5. **No Auto-Archive**: Projects persist until manually deleted (per requirements).

---

## TypeScript Types

Add to `shared/src/types/index.ts`:

```typescript
// Project Registry types
export interface Project {
  id: string;
  name: string;
  directoryPath: string;
  githubRepo: string | null;
  gitRemoteUrl: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInstance {
  projectId: string;
  instanceId: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ProjectWithInstances extends Project {
  instances: ProjectInstance[];
  activeInstanceCount: number;
}

export interface CreateProjectRequest {
  directoryPath: string;
  instanceId?: string;  // Optional - associate with instance on creation
}

export interface UpdateProjectRequest {
  name?: string;
  // Note: directoryPath and githubRepo are derived, not manually set
}

// WebSocket events
export type WSServerMessageType =
  | ... // existing types
  | 'project:created'
  | 'project:updated'
  | 'project:deleted'
  | 'project:instance-linked';
```

---

## API Endpoints

### `GET /api/projects`
List all projects, optionally with instance counts.

**Query params:**
- `includeInstances=true` - Include associated instance IDs
- `sortBy=activity|name|created` - Sort order (default: activity)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "yojimbo",
      "directoryPath": "/Users/user/projects/yojimbo",
      "githubRepo": "username/yojimbo",
      "gitRemoteUrl": "git@github.com:username/yojimbo.git",
      "lastActivityAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-10T08:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "activeInstanceCount": 2
    }
  ]
}
```

### `GET /api/projects/:id`
Get single project with full instance list.

### `POST /api/projects`
Create or discover a project. Called when an instance opens a new directory.

**Request body:**
```json
{
  "directoryPath": "/Users/user/projects/myproject",
  "instanceId": "instance-uuid"  // optional
}
```

**Behavior:**
1. Check if project with this `directoryPath` already exists
2. If exists: update `last_activity_at`, link instance if provided, return existing project
3. If not: create new project, extract git info, link instance if provided

### `PATCH /api/projects/:id`
Update project metadata (currently only name is user-editable).

### `DELETE /api/projects/:id`
Permanently delete a project from the registry.

### `POST /api/projects/:id/refresh`
Re-scan the directory for git remote info (useful if user sets up git after initial discovery).

### `GET /api/projects/:id/instances`
List all instances associated with a project.

### `POST /api/projects/:id/instances`
Link an instance to a project.

**Request body:**
```json
{
  "instanceId": "instance-uuid"
}
```

### `DELETE /api/projects/:id/instances/:instanceId`
Unlink an instance from a project.

---

## GitHub Repo Extraction

### Parsing Git Remote URL

The git remote URL can be in multiple formats:
- SSH: `git@github.com:owner/repo.git`
- HTTPS: `https://github.com/owner/repo.git`
- HTTPS (no .git): `https://github.com/owner/repo`

**Extraction function:**

```typescript
// server/src/services/projects.service.ts

export function parseGitHubRepo(remoteUrl: string): string | null {
  if (!remoteUrl) return null;

  // SSH format: git@github.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@github\.com:([^/]+\/[^/]+?)(\.git)?$/);
  if (sshMatch) {
    return sshMatch[1].replace(/\.git$/, '');
  }

  // HTTPS format: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = remoteUrl.match(/https?:\/\/github\.com\/([^/]+\/[^/]+?)(\.git)?$/);
  if (httpsMatch) {
    return httpsMatch[1].replace(/\.git$/, '');
  }

  // Not a GitHub URL
  return null;
}

export async function getGitRemoteUrl(directoryPath: string): Promise<string | null> {
  try {
    const { execSync } = await import('child_process');
    const result = execSync('git remote get-url origin', {
      cwd: directoryPath,
      encoding: 'utf8',
      timeout: 5000,
    }).trim();
    return result || null;
  } catch {
    // Not a git repo or no origin remote
    return null;
  }
}

export function deriveProjectName(directoryPath: string, githubRepo: string | null): string {
  // Prefer repo name if available (e.g., "yojimbo" from "username/yojimbo")
  if (githubRepo) {
    const parts = githubRepo.split('/');
    return parts[parts.length - 1];
  }

  // Fall back to directory name
  const pathParts = directoryPath.split('/').filter(Boolean);
  return pathParts[pathParts.length - 1] || 'unknown';
}
```

---

## Service Layer

### `server/src/services/projects.service.ts`

```typescript
import { randomUUID } from 'crypto';
import { getDatabase } from '../db/connection.js';
import { broadcast } from '../websocket/server.js';
import type { Project, ProjectWithInstances } from '@cc-orchestrator/shared';

interface ProjectRow {
  id: string;
  name: string;
  directory_path: string;
  github_repo: string | null;
  git_remote_url: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    directoryPath: row.directory_path,
    githubRepo: row.github_repo,
    gitRemoteUrl: row.git_remote_url,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function discoverOrGetProject(
  directoryPath: string,
  instanceId?: string
): Promise<Project> {
  const db = getDatabase();

  // Normalize path (resolve ~, remove trailing slash)
  const normalizedPath = normalizePath(directoryPath);

  // Check if project exists
  let row = db.prepare(
    'SELECT * FROM projects WHERE directory_path = ?'
  ).get(normalizedPath) as ProjectRow | undefined;

  if (row) {
    // Update last_activity_at
    db.prepare(`
      UPDATE projects
      SET last_activity_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(row.id);

    // Link instance if provided
    if (instanceId) {
      linkInstanceToProject(row.id, instanceId);
    }

    // Return updated project
    row = db.prepare('SELECT * FROM projects WHERE id = ?').get(row.id) as ProjectRow;
    return rowToProject(row);
  }

  // Create new project
  const id = randomUUID();
  const gitRemoteUrl = await getGitRemoteUrl(normalizedPath);
  const githubRepo = parseGitHubRepo(gitRemoteUrl || '');
  const name = deriveProjectName(normalizedPath, githubRepo);

  db.prepare(`
    INSERT INTO projects (id, name, directory_path, github_repo, git_remote_url, last_activity_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(id, name, normalizedPath, githubRepo, gitRemoteUrl);

  // Link instance if provided
  if (instanceId) {
    linkInstanceToProject(id, instanceId);
  }

  row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow;
  const project = rowToProject(row);

  broadcast({ type: 'project:created', project });
  console.log(`📂 Project discovered: ${name} (${normalizedPath})`);

  return project;
}

export function linkInstanceToProject(projectId: string, instanceId: string): void {
  const db = getDatabase();

  // Upsert into project_instances
  db.prepare(`
    INSERT INTO project_instances (project_id, instance_id)
    VALUES (?, ?)
    ON CONFLICT(project_id, instance_id) DO UPDATE SET
      last_seen_at = datetime('now')
  `).run(projectId, instanceId);

  // Update project's last_activity_at
  db.prepare(`
    UPDATE projects SET last_activity_at = datetime('now') WHERE id = ?
  `).run(projectId);
}

export function listProjects(includeInstances: boolean = false): ProjectWithInstances[] {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT p.*,
           (SELECT COUNT(*) FROM project_instances pi
            JOIN instances i ON pi.instance_id = i.id
            WHERE pi.project_id = p.id AND i.closed_at IS NULL) as active_instance_count
    FROM projects p
    ORDER BY p.last_activity_at DESC NULLS LAST
  `).all() as (ProjectRow & { active_instance_count: number })[];

  return rows.map(row => ({
    ...rowToProject(row),
    instances: includeInstances ? getProjectInstances(row.id) : [],
    activeInstanceCount: row.active_instance_count,
  }));
}

export function deleteProject(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);

  if (result.changes > 0) {
    broadcast({ type: 'project:deleted', projectId: id });
    return true;
  }
  return false;
}
```

---

## Integration Points

### 1. Instance Creation Hook
When a new instance is created, call `discoverOrGetProject()`:

```typescript
// In routes/instances.ts POST / handler
const project = await discoverOrGetProject(workingDir, id);
// Optionally include project info in response
```

### 2. CWD Change Hook
When `cwd:changed` event fires, update project association:

```typescript
// In local-status-poller.service.ts or wherever cwd changes are detected
if (newCwd !== oldCwd) {
  await discoverOrGetProject(newCwd, instanceId);
}
```

### 3. WebSocket Events
Add to `WSServerMessage` type:
- `project:created` - New project discovered
- `project:updated` - Project metadata changed
- `project:deleted` - Project removed
- `project:instance-linked` - Instance associated with project

---

## Route File

### `server/src/routes/projects.ts`

```typescript
import { Router, Request, Response } from 'express';
import type { ApiResponse, Project, ProjectWithInstances } from '@cc-orchestrator/shared';
import {
  listProjects,
  getProject,
  discoverOrGetProject,
  updateProject,
  deleteProject,
  refreshProjectGitInfo,
  linkInstanceToProject,
  unlinkInstanceFromProject,
  getProjectInstances,
} from '../services/projects.service.js';

const router = Router();

// GET /api/projects - List all projects
router.get('/', (req: Request, res: Response) => {
  try {
    const includeInstances = req.query.includeInstances === 'true';
    const projects = listProjects(includeInstances);
    const response: ApiResponse<ProjectWithInstances[]> = { success: true, data: projects };
    res.json(response);
  } catch (error) {
    console.error('Failed to list projects:', error);
    res.status(500).json({ success: false, error: 'Failed to list projects' });
  }
});

// POST /api/projects - Discover or create project
router.post('/', async (req: Request, res: Response) => {
  try {
    const { directoryPath, instanceId } = req.body;

    if (!directoryPath) {
      return res.status(400).json({ success: false, error: 'directoryPath is required' });
    }

    const project = await discoverOrGetProject(directoryPath, instanceId);
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('Failed to discover project:', error);
    res.status(500).json({ success: false, error: 'Failed to discover project' });
  }
});

// GET /api/projects/:id
router.get('/:id', (req: Request, res: Response) => {
  try {
    const project = getProject(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Failed to get project:', error);
    res.status(500).json({ success: false, error: 'Failed to get project' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const project = updateProject(req.params.id, { name });
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Failed to update project:', error);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteProject(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
});

// POST /api/projects/:id/refresh - Re-scan git info
router.post('/:id/refresh', async (req: Request, res: Response) => {
  try {
    const project = await refreshProjectGitInfo(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Failed to refresh project:', error);
    res.status(500).json({ success: false, error: 'Failed to refresh project' });
  }
});

// GET /api/projects/:id/instances
router.get('/:id/instances', (req: Request, res: Response) => {
  try {
    const instances = getProjectInstances(req.params.id);
    res.json({ success: true, data: instances });
  } catch (error) {
    console.error('Failed to get project instances:', error);
    res.status(500).json({ success: false, error: 'Failed to get project instances' });
  }
});

// POST /api/projects/:id/instances
router.post('/:id/instances', (req: Request, res: Response) => {
  try {
    const { instanceId } = req.body;
    if (!instanceId) {
      return res.status(400).json({ success: false, error: 'instanceId is required' });
    }
    linkInstanceToProject(req.params.id, instanceId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to link instance:', error);
    res.status(500).json({ success: false, error: 'Failed to link instance' });
  }
});

// DELETE /api/projects/:id/instances/:instanceId
router.delete('/:id/instances/:instanceId', (req: Request, res: Response) => {
  try {
    unlinkInstanceFromProject(req.params.id, req.params.instanceId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to unlink instance:', error);
    res.status(500).json({ success: false, error: 'Failed to unlink instance' });
  }
});

export default router;
```

---

## Migration Strategy

Add to `runMigrations()` in `server/src/db/connection.ts`:

```typescript
// Check if projects table exists
const projectsTableExists = db.prepare(`
  SELECT name FROM sqlite_master WHERE type='table' AND name='projects'
`).get();

if (!projectsTableExists) {
  console.log('Running migration: creating projects table');
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      directory_path TEXT NOT NULL UNIQUE,
      github_repo TEXT,
      git_remote_url TEXT,
      last_activity_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE project_instances (
      project_id TEXT NOT NULL,
      instance_id TEXT NOT NULL,
      first_seen_at TEXT DEFAULT (datetime('now')),
      last_seen_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, instance_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_projects_directory ON projects(directory_path);
    CREATE INDEX idx_projects_github ON projects(github_repo);
    CREATE INDEX idx_projects_activity ON projects(last_activity_at DESC);
    CREATE INDEX idx_project_instances_project ON project_instances(project_id);
    CREATE INDEX idx_project_instances_instance ON project_instances(instance_id);
  `);
}
```

---

## Summary

### Files to Create/Modify

1. **New Files:**
   - `server/src/routes/projects.ts` - API routes
   - `server/src/services/projects.service.ts` - Business logic

2. **Modified Files:**
   - `server/src/db/connection.ts` - Add schema and migrations
   - `server/src/app.ts` - Register projects router
   - `shared/src/types/index.ts` - Add Project types
   - `server/src/routes/instances.ts` - Call discoverOrGetProject on instance creation

### Key Features

- Automatic project discovery when instances open directories
- GitHub repo extraction from git remote URL
- Many-to-many relationship between projects and instances
- Manual cleanup only (no auto-archiving)
- Last activity tracking for sorting
- WebSocket broadcasts for real-time updates
