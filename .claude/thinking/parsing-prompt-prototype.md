# Task Parsing Prompt Prototype

> Prompt engineering for parsing free-form task input into structured tasks with project matching.

## CLI Integration Note

**Schema Enforcement**: When invoking via CLI, use the `--json-schema` flag to guarantee output matches our schema:

```bash
claude -p "$INPUT" \
  --append-system-prompt-file ./prompts/task-parser.txt \
  --output-format json \
  --json-schema '$(cat ./schemas/parsed-tasks.json)' \
  --max-turns 1 \
  --tools ""
```

The response's `structured_output` field will contain a `ParsedTasksResponse` guaranteed to match the schema. This means the prompt below focuses on *how* to parse, not *what format* to output—the schema handles format enforcement.

---

## 1. System Prompt

```
You are a task parser for a developer workflow tool. Your job is to take free-form task input and convert it into structured, actionable tasks matched to the correct projects.

## Input Format

You will receive:
1. Raw task input (voice transcription or typed text)
2. Project context (list of known projects with metadata)

## Output Requirements

Respond with a JSON object matching this schema:

{
  "tasks": [
    {
      "id": "task_<8-char-uuid>",
      "originalText": "<portion of input this task came from>",
      "title": "<clean, actionable task title>",
      "type": "<bug|feature|enhancement|refactor|docs|other>",
      "projectId": "<matched project ID or null>",
      "projectConfidence": <0.0-1.0>,
      "clarity": "<clear|ambiguous|unknown_project>",
      "clarificationNeeded": { "question": "<question to ask user>" }  // only if clarity != "clear"
    }
  ],
  "suggestedOrder": ["task_id1", "task_id2", ...]
}

## Parsing Rules

### Task Splitting
- Split on natural boundaries: commas, "and", semicolons, numbered lists
- Keep compound tasks together if they're truly one unit of work
- Preserve context from earlier in the sentence when splitting

### Task Type Classification
Use these signals:
- **bug**: "fix", "broken", "not working", "error", "crash", "issue with"
- **feature**: "add", "create", "new", "implement", "build"
- **enhancement**: "improve", "better", "optimize", "update", "upgrade"
- **refactor**: "refactor", "restructure", "clean up", "reorganize"
- **docs**: "document", "readme", "docs", "comments", "explain"
- **other**: when none of the above clearly apply

### Project Matching
Match tasks to projects using these signals (in priority order):
1. **Explicit mention**: "in yojimbo", "for the dashboard app"
2. **Technical context**: "auth bug" matches a project with auth-related code
3. **Recent activity**: prefer projects with recent commits if ambiguous
4. **Domain keywords**: "API perf" matches backend projects

Confidence levels:
- **0.9-1.0**: Explicit project mention or strong unique match
- **0.7-0.89**: Good contextual match, likely correct
- **0.5-0.69**: Possible match, but ambiguous
- **<0.5**: Uncertain, likely unknown_project

### Clarity Assessment
- **clear**: High confidence match (>0.7) AND task is specific enough to act on
- **ambiguous**: Task is vague OR could match multiple projects
- **unknown_project**: No project match found (<0.5 confidence)

### Priority/Ordering
Infer priority from:
1. Explicit markers: "urgent", "ASAP", "when you get a chance"
2. Task type: bugs typically before features
3. Dependencies: setup tasks before dependent tasks
4. Specificity: clearer tasks before vague ones

### Clarification Questions
Write natural, conversational questions:
- For ambiguous tasks: "What specifically should be improved about the API performance?"
- For unknown projects: "Which project is the auth bug in? I see you have: [project list]"
- Keep questions focused on ONE piece of missing information
```

## 2. Project Context Format

```json
{
  "projects": [
    {
      "id": "proj_yojimbo",
      "name": "yojimbo",
      "path": "/Users/dev/projects/yojimbo",
      "repoName": "yojimbo",
      "instanceName": "yojimbo-main",
      "keywords": ["orchestrator", "claude", "tasks", "instances"],
      "recentBranches": ["main", "feature/voice-input"],
      "lastActivity": "2025-01-19T10:00:00Z"
    },
    {
      "id": "proj_dashboard",
      "name": "dashboard-app",
      "path": "/Users/dev/projects/dashboard",
      "repoName": "customer-dashboard",
      "instanceName": "dashboard-dev",
      "keywords": ["react", "analytics", "charts", "customer"],
      "recentBranches": ["main", "fix/auth-refresh"],
      "lastActivity": "2025-01-18T15:30:00Z"
    },
    {
      "id": "proj_api",
      "name": "backend-api",
      "path": "/Users/dev/projects/api-server",
      "repoName": "api-v2",
      "instanceName": "api-instance",
      "keywords": ["node", "express", "postgres", "rest", "auth"],
      "recentBranches": ["main", "perf/query-optimization"],
      "lastActivity": "2025-01-19T08:00:00Z"
    }
  ]
}
```

### Context Field Descriptions

| Field | Purpose | Matching Weight |
|-------|---------|-----------------|
| `name` | Directory/display name | High - exact matches |
| `path` | Full path for disambiguation | Low - rarely mentioned |
| `repoName` | GitHub repo name | High - often mentioned |
| `instanceName` | Running instance name | Medium - technical users |
| `keywords` | Domain terms from README/code | Medium - contextual |
| `recentBranches` | Active work signals | Low - recency tiebreaker |
| `lastActivity` | Timestamp of last work | Low - recency tiebreaker |

## 3. Test Cases

### Test Case 1: Simple Multi-Task Input

**Input:**
```
fix auth bug, add dark mode, improve API perf
```

**Project Context:** (using format above with yojimbo, dashboard-app, backend-api)

**Expected Output:**
```json
{
  "tasks": [
    {
      "id": "task_a1b2c3d4",
      "originalText": "fix auth bug",
      "title": "Fix authentication bug",
      "type": "bug",
      "projectId": "proj_api",
      "projectConfidence": 0.75,
      "clarity": "ambiguous",
      "clarificationNeeded": {
        "question": "What's the specific auth issue? (e.g., login failing, token expiring, session lost)"
      }
    },
    {
      "id": "task_e5f6g7h8",
      "originalText": "add dark mode",
      "title": "Add dark mode support",
      "type": "feature",
      "projectId": "proj_dashboard",
      "projectConfidence": 0.65,
      "clarity": "ambiguous",
      "clarificationNeeded": {
        "question": "Is the dark mode for the dashboard app or another project?"
      }
    },
    {
      "id": "task_i9j0k1l2",
      "originalText": "improve API perf",
      "title": "Improve API performance",
      "type": "enhancement",
      "projectId": "proj_api",
      "projectConfidence": 0.85,
      "clarity": "ambiguous",
      "clarificationNeeded": {
        "question": "Which API endpoints need performance improvements?"
      }
    }
  ],
  "suggestedOrder": ["task_a1b2c3d4", "task_i9j0k1l2", "task_e5f6g7h8"]
}
```

**Rationale:**
- Bug fix ordered first (higher priority)
- API perf second (enhancement to existing system)
- Feature (dark mode) last (new work)
- All marked ambiguous because they lack specifics

---

### Test Case 2: Explicit Project Mentions

**Input:**
```
in yojimbo fix the websocket reconnection issue and add keyboard shortcuts for task navigation
```

**Expected Output:**
```json
{
  "tasks": [
    {
      "id": "task_m3n4o5p6",
      "originalText": "fix the websocket reconnection issue",
      "title": "Fix WebSocket reconnection issue",
      "type": "bug",
      "projectId": "proj_yojimbo",
      "projectConfidence": 0.95,
      "clarity": "clear"
    },
    {
      "id": "task_q7r8s9t0",
      "originalText": "add keyboard shortcuts for task navigation",
      "title": "Add keyboard shortcuts for task navigation",
      "type": "feature",
      "projectId": "proj_yojimbo",
      "projectConfidence": 0.95,
      "clarity": "clear"
    }
  ],
  "suggestedOrder": ["task_m3n4o5p6", "task_q7r8s9t0"]
}
```

**Rationale:**
- "in yojimbo" provides explicit project context (0.95 confidence)
- Both tasks inherit the project context
- Bug fix before feature add
- Both clear because project is known and tasks are specific

---

### Test Case 3: Unknown Project

**Input:**
```
refactor the payment processing module to use the new Stripe SDK
```

**Project Context:** (same 3 projects, none related to payments)

**Expected Output:**
```json
{
  "tasks": [
    {
      "id": "task_u1v2w3x4",
      "originalText": "refactor the payment processing module to use the new Stripe SDK",
      "title": "Refactor payment processing to use new Stripe SDK",
      "type": "refactor",
      "projectId": null,
      "projectConfidence": 0.2,
      "clarity": "unknown_project",
      "clarificationNeeded": {
        "question": "Which project has the payment processing module? Your active projects are: yojimbo, dashboard-app, backend-api"
      }
    }
  ],
  "suggestedOrder": ["task_u1v2w3x4"]
}
```

**Rationale:**
- No project matches "payment" or "Stripe" keywords
- Very low confidence triggers unknown_project
- Clarification lists all projects for user to pick

---

### Test Case 4: Voice Input with Filler Words

**Input:**
```
okay so um I need to like fix that bug where the dashboard crashes when you um filter by date and also maybe add some better error messages to the API
```

**Expected Output:**
```json
{
  "tasks": [
    {
      "id": "task_y5z6a7b8",
      "originalText": "fix that bug where the dashboard crashes when you filter by date",
      "title": "Fix dashboard crash when filtering by date",
      "type": "bug",
      "projectId": "proj_dashboard",
      "projectConfidence": 0.9,
      "clarity": "clear"
    },
    {
      "id": "task_c9d0e1f2",
      "originalText": "add some better error messages to the API",
      "title": "Improve API error messages",
      "type": "enhancement",
      "projectId": "proj_api",
      "projectConfidence": 0.85,
      "clarity": "ambiguous",
      "clarificationNeeded": {
        "question": "Which API endpoints need better error messages, or should this apply globally?"
      }
    }
  ],
  "suggestedOrder": ["task_y5z6a7b8", "task_c9d0e1f2"]
}
```

**Rationale:**
- Filler words ("okay so um", "like", "maybe") stripped from titles
- "dashboard crashes" strongly matches dashboard-app
- "API" matches backend-api
- First task is clear (specific bug), second is ambiguous (which endpoints?)

---

### Test Case 5: Prioritization Signals

**Input:**
```
when you get a chance update the readme, but URGENT fix the production memory leak in the api server, and also add unit tests for the new auth flow
```

**Expected Output:**
```json
{
  "tasks": [
    {
      "id": "task_g3h4i5j6",
      "originalText": "URGENT fix the production memory leak in the api server",
      "title": "Fix production memory leak in API server",
      "type": "bug",
      "projectId": "proj_api",
      "projectConfidence": 0.95,
      "clarity": "clear"
    },
    {
      "id": "task_k7l8m9n0",
      "originalText": "add unit tests for the new auth flow",
      "title": "Add unit tests for new auth flow",
      "type": "feature",
      "projectId": "proj_api",
      "projectConfidence": 0.8,
      "clarity": "clear"
    },
    {
      "id": "task_o1p2q3r4",
      "originalText": "when you get a chance update the readme",
      "title": "Update README",
      "type": "docs",
      "projectId": null,
      "projectConfidence": 0.3,
      "clarity": "unknown_project",
      "clarificationNeeded": {
        "question": "Which project's README should be updated?"
      }
    }
  ],
  "suggestedOrder": ["task_g3h4i5j6", "task_k7l8m9n0", "task_o1p2q3r4"]
}
```

**Rationale:**
- "URGENT" promotes memory leak to highest priority
- "when you get a chance" demotes README to lowest
- Auth flow tests logically after the bug fix (both in API)
- README lacks project context

---

## 4. Prompt Engineering Notes

### Design Decisions

#### 1. Structured Output Over Free-Form
**Decision:** Use strict JSON schema output instead of natural language.

**Rationale:**
- Downstream systems need to parse the response programmatically
- Eliminates ambiguity in field extraction
- Easier to validate and handle errors
- Supports type safety in TypeScript consumers

**Trade-off:** Less natural interaction, but the clarification questions provide the human touch where needed.

#### 2. Confidence Scores as Continuous Values
**Decision:** Use 0-1 floats instead of discrete confidence levels.

**Rationale:**
- Allows fine-grained UI decisions (e.g., show warning at 0.6 vs 0.8)
- Supports thresholding at different levels for different contexts
- More honest about uncertainty

**Trade-off:** Harder for the model to calibrate precisely, may need prompt examples to anchor expectations.

#### 3. Separate Clarity from Confidence
**Decision:** `clarity` is a discrete assessment separate from `projectConfidence`.

**Rationale:**
- A task can be clear but have unknown project (specific task, nowhere to put it)
- A task can match a project but be vague (we know where, but not what)
- Separating these enables better UX (different UI flows for each)

**Trade-off:** Slightly more complex schema, but captures real-world nuance.

#### 4. Single Clarification Question Per Task
**Decision:** Only one `question` field, not multiple.

**Rationale:**
- Keeps clarification focused
- Matches conversational flow (one question at a time)
- Reduces cognitive load on user
- If multiple things are unclear, prioritize the most blocking one

**Trade-off:** May require multiple rounds for very ambiguous tasks.

#### 5. Keywords in Project Context
**Decision:** Include extracted keywords from README/code.

**Rationale:**
- Enables semantic matching beyond exact name matches
- "auth bug" can match a project with "authentication" keyword
- Reduces need for users to always mention project names

**Trade-off:** Keywords need maintenance, can drift from actual codebase. Consider auto-extraction.

#### 6. Suggested Order as Separate Field
**Decision:** Return ordering recommendation separately from task list.

**Rationale:**
- Tasks array is stable (one entry per task)
- Order can be overridden by user preference
- Clear separation of concerns
- Easier to test ordering logic independently

**Trade-off:** Slight redundancy (IDs appear twice), but clearer semantics.

### Potential Improvements

1. **Few-shot examples in prompt:** Add 2-3 input/output examples directly in the system prompt for better calibration.

2. **Domain-specific keywords:** For known tech stacks, add framework-specific keywords (React, Express, etc.) that map to project types.

3. **Conversation history:** If implementing multi-turn, consider including previous clarification rounds in context.

4. **User preferences:** Some users might always want bugs first, others want to preserve input order. Consider a `userPreferences` input.

5. **Batch efficiency:** For many projects (10+), consider summarizing inactive ones to save tokens.

### Token Budget Estimation

| Component | Tokens (approx) |
|-----------|-----------------|
| System prompt | 800-1000 |
| Project context (5 projects) | 400-600 |
| Project context (10 projects) | 800-1200 |
| User input (typical) | 50-200 |
| Output (3 tasks) | 300-500 |
| **Total (5 projects, 3 tasks)** | **1550-2300** |

This fits comfortably in Claude's context and keeps costs low per parse operation.

---

## 5. JSON Schema for CLI Enforcement

Use this schema with `--json-schema` to guarantee structured output:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["tasks", "suggestedOrder"],
  "properties": {
    "tasks": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "originalText", "title", "type", "projectId", "projectConfidence", "clarity"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^task_[a-z0-9]{8}$",
            "description": "Unique task identifier"
          },
          "originalText": {
            "type": "string",
            "description": "The portion of user input this task came from"
          },
          "title": {
            "type": "string",
            "description": "Clean, actionable task title"
          },
          "type": {
            "type": "string",
            "enum": ["bug", "feature", "enhancement", "refactor", "docs", "other"]
          },
          "projectId": {
            "type": ["string", "null"],
            "description": "Matched project ID or null if unknown"
          },
          "projectConfidence": {
            "type": "number",
            "minimum": 0,
            "maximum": 1,
            "description": "Confidence in project match (0-1)"
          },
          "clarity": {
            "type": "string",
            "enum": ["clear", "ambiguous", "unknown_project"]
          },
          "clarificationNeeded": {
            "type": "object",
            "properties": {
              "question": {
                "type": "string",
                "description": "Natural language question for the user"
              }
            },
            "required": ["question"]
          }
        }
      }
    },
    "suggestedOrder": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Task IDs in recommended priority order"
    }
  }
}
```

**Save as:** `server/src/prompts/parsed-tasks-schema.json`

**Usage:**
```bash
claude -p "..." \
  --json-schema "$(cat server/src/prompts/parsed-tasks-schema.json)" \
  --output-format json
```

The CLI guarantees the `structured_output` field matches this schema exactly.

---

*Created: January 2025*
*Updated: January 2026 - Added JSON Schema for CLI enforcement*
*Status: Prototype ready for implementation testing*
