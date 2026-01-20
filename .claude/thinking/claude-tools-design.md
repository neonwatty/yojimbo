# Context Gathering Functions for Smart Task Parsing

> Functions to gather project/instance context before invoking the Claude CLI for task parsing.

## Overview

**Architecture Decision**: We're using the CLI subprocess approach (not SDK with dynamic tools). This means Claude cannot make on-demand lookups. Instead, these functions run **before** invoking the CLI to pre-load all necessary context into the prompt.

**Previous design**: These were MCP tools that Claude would call dynamically.
**Current design**: These are server-side functions that gather context, which gets serialized into the prompt.

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│ Context Gathering   │────▶│   Build Prompt      │────▶│   claude CLI    │
│ (these functions)   │     │ (include context)   │     │   subprocess    │
└─────────────────────┘     └─────────────────────┘     └─────────────────┘
```

The function signatures and response formats below remain useful—they define what data we gather and how to format it token-efficiently.

## Tool Definitions

### 1. get_instance_status

Returns the current state of all running instances, helping Claude understand what's actively being worked on.

```typescript
const getInstanceStatusTool = {
  name: "get_instance_status",
  description: "Get status of all running Claude Code instances. Returns which instances are currently active, their working directories, and their operational status (working/idle). Use this to understand what projects are currently being worked on and route tasks appropriately.",
  input_schema: {
    type: "object",
    properties: {},
    required: []
  }
};
```

**Response format** (token-efficient):
```typescript
interface InstanceStatusResponse {
  instances: Array<{
    id: string;
    name: string;
    dir: string;           // workingDir, shortened key
    status: 'working' | 'idle';
    project?: string;      // projectId if registered
  }>;
}
```

**Example response**:
```json
{
  "instances": [
    { "id": "abc123", "name": "yojimbo-dev", "dir": "~/Desktop/yojimbo-dev", "status": "working", "project": "proj_1" },
    { "id": "def456", "name": "social-tools", "dir": "~/Code/social-tools", "status": "idle", "project": "proj_2" }
  ]
}
```

### 2. get_git_state

Returns git repository state for a specific project, providing recency signals.

```typescript
const getGitStateTool = {
  name: "get_git_state",
  description: "Get the current git state for a project directory. Returns current branch, recent commits (last 5), and whether there are uncommitted changes. Use this for recency signals when matching tasks to projects.",
  input_schema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The project ID to get git state for"
      },
      path: {
        type: "string",
        description: "Alternative: absolute path to the project directory (use if projectId unknown)"
      }
    },
    required: []
  }
};
```

**Response format**:
```typescript
interface GitStateResponse {
  branch: string;
  commits: Array<{
    hash: string;        // Short hash (7 chars)
    msg: string;         // First line, truncated to 80 chars
    age: string;         // Relative time, e.g., "2 hours ago"
  }>;
  dirty: boolean;        // Has uncommitted changes
  ahead?: number;        // Commits ahead of remote
  behind?: number;       // Commits behind remote
}
```

**Example response**:
```json
{
  "branch": "feature/smart-tasks",
  "commits": [
    { "hash": "abc1234", "msg": "Add project registry schema", "age": "2 hours ago" },
    { "hash": "def5678", "msg": "Implement task parsing endpoint", "age": "5 hours ago" }
  ],
  "dirty": true,
  "ahead": 3
}
```

### 3. get_readme

Returns README content for uncertain project matching.

```typescript
const getReadmeTool = {
  name: "get_readme",
  description: "Get the README.md content for a project. Returns the first 2000 characters of the README, useful for understanding what a project does when matching is uncertain. Use sparingly - only when project name/path isn't sufficient.",
  input_schema: {
    type: "object",
    properties: {
      projectId: {
        type: "string",
        description: "The project ID to get README for"
      },
      path: {
        type: "string",
        description: "Alternative: absolute path to the project directory (use if projectId unknown)"
      }
    },
    required: []
  }
};
```

**Response format**:
```typescript
interface ReadmeResponse {
  content: string | null;  // First 2000 chars, null if not found
  truncated: boolean;      // True if content was truncated
  path: string;            // Actual path to README file found
}
```

**Example response**:
```json
{
  "content": "# Yojimbo\n\nA Claude Code orchestrator for managing multiple instances...",
  "truncated": true,
  "path": "/Users/foo/yojimbo-dev/README.md"
}
```

## Implementation Approach

### Tool Execution Layer

Create a new service file: `server/src/services/claude-tools.service.ts`

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDatabase } from '../db/connection.js';
import type { Instance, InstanceStatus } from '@cc-orchestrator/shared';

const execAsync = promisify(exec);

interface InstanceRow {
  id: string;
  name: string;
  working_dir: string;
  status: InstanceStatus;
}

// Expand ~ to home directory
function expandPath(p: string): string {
  return p.replace(/^~/, os.homedir());
}

// Compress path for response (use ~ for home)
function compressPath(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? p.replace(home, '~') : p;
}

/**
 * Get status of all running instances
 */
export async function getInstanceStatus(): Promise<{
  instances: Array<{
    id: string;
    name: string;
    dir: string;
    status: 'working' | 'idle';
    project?: string;
  }>;
}> {
  const db = getDatabase();

  const instances = db.prepare(`
    SELECT i.id, i.name, i.working_dir, i.status
    FROM instances i
    WHERE i.closed_at IS NULL
    ORDER BY i.display_order
  `).all() as InstanceRow[];

  // TODO: Join with projects table when it exists
  return {
    instances: instances.map(i => ({
      id: i.id,
      name: i.name,
      dir: compressPath(i.working_dir),
      status: i.status === 'working' ? 'working' : 'idle',
    }))
  };
}

/**
 * Get git state for a project directory
 */
export async function getGitState(options: {
  projectId?: string;
  path?: string;
}): Promise<{
  branch: string;
  commits: Array<{ hash: string; msg: string; age: string }>;
  dirty: boolean;
  ahead?: number;
  behind?: number;
} | { error: string }> {
  let workingDir: string;

  if (options.path) {
    workingDir = expandPath(options.path);
  } else if (options.projectId) {
    // TODO: Look up path from projects table
    return { error: 'Project lookup not yet implemented' };
  } else {
    return { error: 'Either projectId or path is required' };
  }

  // Verify directory exists
  if (!fs.existsSync(workingDir)) {
    return { error: `Directory not found: ${workingDir}` };
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
          age
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
 * Get README content for a project
 */
export async function getReadme(options: {
  projectId?: string;
  path?: string;
}): Promise<{
  content: string | null;
  truncated: boolean;
  path: string;
} | { error: string }> {
  let workingDir: string;

  if (options.path) {
    workingDir = expandPath(options.path);
  } else if (options.projectId) {
    // TODO: Look up path from projects table
    return { error: 'Project lookup not yet implemented' };
  } else {
    return { error: 'Either projectId or path is required' };
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
      path: path.join(workingDir, 'README.md')
    };
  }

  try {
    const MAX_CHARS = 2000;
    const content = fs.readFileSync(readmePath, 'utf-8');
    const truncated = content.length > MAX_CHARS;

    return {
      content: truncated ? content.slice(0, MAX_CHARS) : content,
      truncated,
      path: readmePath
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { error: `Failed to read README: ${msg}` };
  }
}
```

### API Endpoint for Tool Execution

Add to existing routes or create new: `server/src/routes/claude-tools.ts`

```typescript
import { Router } from 'express';
import {
  getInstanceStatus,
  getGitState,
  getReadme
} from '../services/claude-tools.service.js';

const router = Router();

// POST /api/claude-tools/execute
// Executes a tool and returns the result
router.post('/execute', async (req, res) => {
  try {
    const { tool, input } = req.body;

    let result;
    switch (tool) {
      case 'get_instance_status':
        result = await getInstanceStatus();
        break;
      case 'get_git_state':
        result = await getGitState(input || {});
        break;
      case 'get_readme':
        result = await getReadme(input || {});
        break;
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown tool: ${tool}`
        });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Tool execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Tool execution failed'
    });
  }
});

// GET /api/claude-tools/definitions
// Returns tool definitions for Claude API calls
router.get('/definitions', (_req, res) => {
  res.json({
    success: true,
    data: {
      tools: [
        {
          name: 'get_instance_status',
          description: 'Get status of all running Claude Code instances.',
          input_schema: { type: 'object', properties: {}, required: [] }
        },
        {
          name: 'get_git_state',
          description: 'Get git state for a project directory.',
          input_schema: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
              path: { type: 'string' }
            },
            required: []
          }
        },
        {
          name: 'get_readme',
          description: 'Get README.md content for a project.',
          input_schema: {
            type: 'object',
            properties: {
              projectId: { type: 'string' },
              path: { type: 'string' }
            },
            required: []
          }
        }
      ]
    }
  });
});

export default router;
```

## Error Handling

### Git Failures

```typescript
// When git is not installed or not a repo
{ "error": "Git command failed: not a git repository" }

// When directory doesn't exist
{ "error": "Directory not found: /path/to/missing" }
```

### README Not Found

Return null content instead of error - this is a valid state:

```json
{
  "content": null,
  "truncated": false,
  "path": "/expected/path/README.md"
}
```

### Instance Status - Always Succeeds

Even with no instances, return empty array:

```json
{
  "instances": []
}
```

## Token Efficiency Strategies

1. **Short keys**: Use `dir` instead of `workingDir`, `msg` instead of `message`

2. **Compressed paths**: Use `~` for home directory in responses

3. **Truncation**: README content capped at 2000 chars, commit messages at 80 chars

4. **Limited history**: Only return last 5 commits, not full log

5. **Sparse data**: Omit `ahead`/`behind` if not available instead of including nulls

6. **No timestamps**: Use relative time ("2 hours ago") instead of ISO timestamps for commits

## Example Token Counts (Approximate)

| Response Type | Example Size | Tokens |
|---------------|--------------|--------|
| 5 instances   | 350 chars    | ~100   |
| Git state     | 400 chars    | ~120   |
| README (full) | 2200 chars   | ~650   |

## Integration with Task Parsing

The task parsing flow will:

1. **Start with lightweight context** - Project names, paths, repo names from registry
2. **Call get_instance_status** - Understand what's currently active
3. **Call get_git_state** - For recent activity signals when matching is uncertain
4. **Call get_readme** - Last resort for unclear project matching

### Example Tool Use in Conversation

```
User: "fix the auth bug in yojimbo"

Claude's reasoning:
- "yojimbo" matches project name directly
- Call get_instance_status to check if there's an active instance
- If instance exists and is idle, route task there
- If no instance, suggest creating one

[tool_use: get_instance_status]
→ Returns: instance "yojimbo-dev" is idle

Result: Route task to instance "yojimbo-dev"
```

## Future Enhancements

1. **Project registry integration**: Once the projects table exists, support `projectId` lookups

2. **Cache layer**: Cache README content for 5 minutes to avoid repeated file reads

3. **Additional tools**:
   - `get_recent_files(projectId)` - Recently modified files
   - `get_dependencies(projectId)` - package.json/Cargo.toml/etc.
   - `search_code(projectId, query)` - Basic grep

4. **Rate limiting**: Prevent excessive tool calls in a single parsing session

---

*Created: January 2025*
