# Idea: Smart Tasks API Integration

> Use Claude Code CLI (subprocess) to parse free-form task input, intelligently match tasks to projects, and handle multi-turn clarification for accurate task routing—using your existing Claude Code subscription.

## The Problem

When dumping tasks via voice or text, you want them automatically routed to the right project/instance without manually selecting the target each time. This requires understanding natural language, matching context to known projects, and asking good clarifying questions when needed.

**Current state**: Tasks are manually created and dispatched to instances. No intelligence in the routing.

**Desired state**: Dump "fix the auth bug, add dark mode to settings, improve API perf" and have Claude parse this into 3 structured tasks, match each to the right project, and route them—with 95%+ accuracy.

## The Solution

An API integration layer that:

1. **Parses** free-form input into discrete tasks
2. **Matches** each task to a project using lightweight context + on-demand lookups
3. **Clarifies** ambiguous tasks through conversational multi-turn dialogue
4. **Routes** tasks to the appropriate instances

### Architecture Overview

**Decision: CLI Subprocess Approach**

We use the `claude` CLI via subprocess instead of the SDK. This lets us leverage your existing Claude Code subscription (no separate API key/billing) at the cost of some flexibility.

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────▶│  Yojimbo Server │────▶│   claude CLI    │
│  (raw text) │     │ (builds context)│     │  (subprocess)   │
└─────────────┘     └─────────────────┘     └─────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │  Pre-load ALL   │
                    │    context:     │
                    │ - Projects      │
                    │ - Instances     │
                    │ - Git state     │
                    │ - READMEs       │
                    └─────────────────┘
```

**Key difference from SDK approach**: No dynamic tools. All context must be gathered upfront and included in the prompt.

### Context Strategy (Pre-loaded)

Since we can't use dynamic tools with the CLI approach, **all context is gathered upfront** before invoking Claude.

**Per project (always included):**
- Project name (directory name or configured)
- Directory path
- GitHub repo name (parsed from git remote)
- Associated instance name
- Current git branch
- Last 3-5 commit messages (for recency signals)

**Per instance (always included):**
- Instance ID and name
- Current status (idle, working, error)
- Working directory / associated project
- What it's currently doing (if working)

**Optional (for uncertain matches):**
- README content (first ~500 chars, truncated)

**Token budget estimate**: ~200-400 tokens per project, ~100 tokens per instance. For 5-10 projects and 3-5 instances: ~1500-4500 tokens of context.

**Tradeoff**: Larger prompts than SDK approach, but simpler architecture and uses existing subscription.

### Project Registry

**Discovery**: Projects are added to the registry when a Claude Code instance first opens them. Organic, low-friction.

**Stored data**:
```typescript
interface Project {
  id: string;
  name: string;              // Display name
  path: string;              // Absolute path
  gitRemote?: string;        // e.g., "github.com/user/repo"
  repoName?: string;         // Extracted repo name
  instanceIds: string[];     // Associated instances
  lastActivity?: Date;       // Last time an instance worked here
  createdAt: Date;
}
```

**Lifecycle**: Manual cleanup when projects go stale. No auto-archiving.

### Response Schema

```typescript
interface ParsedTasksResponse {
  tasks: Array<{
    id: string;
    originalText: string;      // Portion of input this came from
    title: string;             // Clean, actionable title
    type: 'bug' | 'feature' | 'enhancement' | 'refactor' | 'docs' | 'other';

    // Matching
    projectId: string | null;  // Matched project or null
    projectConfidence: number; // 0-1 confidence

    // Clarity
    clarity: 'clear' | 'ambiguous' | 'unknown_project';
    clarificationNeeded?: {
      question: string;        // Natural language question
    };
  }>;

  // Suggested ordering (Claude infers priority)
  suggestedOrder: string[];    // Task IDs in recommended order
}
```

### Clarification Flow

**Style**: Conversational (free text input, not just quick-select)

**Limits**: 2-3 rounds maximum before task is marked for manual review

**Unknown project handling**: Show project picker with all options, no assumptions

**Multi-project tasks**: Automatically split into separate tasks, one per project

**CLI Implementation Options for Multi-turn:**

1. **Session resumption** (preferred): Use `claude --resume <session-id>` to continue a conversation
   ```bash
   # First call - parse tasks
   claude -p "Parse these tasks: ..." --output-format stream-json
   # Returns session ID + tasks with clarification questions

   # Follow-up call - provide clarification
   claude --resume <session-id> -p "The dark mode should be for app settings"
   ```

2. **Stateless with context**: Include previous Q&A in subsequent prompts
   ```bash
   # Include clarification history in prompt
   claude -p "Previous: ... User clarified: ... Now finalize the task parsing"
   ```

**Recommendation**: Start with stateless approach (simpler), add session resumption if needed for complex clarifications.

### CLI Invocation Pattern

**Key CLI Flags We're Leveraging:**

| Flag | Purpose |
|------|---------|
| `--output-format json` | Structured JSON output with session_id, result, cost |
| `--json-schema` | **Enforced structured output** - guarantees response matches our schema |
| `--append-system-prompt-file` | Load parsing instructions from file (preserves Claude Code capabilities) |
| `--max-turns 1` | Single response, no runaway execution |
| `--tools ""` | Disable all tools (pure text parsing, no file access) |
| `--resume <session-id>` | Continue conversation for clarification rounds |

**Basic Parsing Call:**

```bash
claude -p "$USER_INPUT" \
  --append-system-prompt-file ./prompts/task-parser.txt \
  --output-format json \
  --json-schema "$PARSED_TASKS_SCHEMA" \
  --max-turns 1 \
  --tools ""
```

**With Context via stdin:**

```bash
echo "$PROJECT_CONTEXT" | claude -p "Parse these tasks: $USER_INPUT" \
  --append-system-prompt-file ./prompts/task-parser.txt \
  --output-format json \
  --json-schema "$PARSED_TASKS_SCHEMA" \
  --max-turns 1 \
  --tools ""
```

**Multi-turn Clarification:**

```bash
# First call - returns session_id in JSON response
result=$(claude -p "..." --output-format json --json-schema "...")
session_id=$(echo "$result" | jq -r '.session_id')

# Follow-up with clarification
claude --resume "$session_id" -p "User clarified: App settings theme toggle" \
  --output-format json \
  --json-schema "$PARSED_TASKS_SCHEMA"
```

**JSON Response Structure:**

```json
{
  "session_id": "uuid-here",
  "result": "...",
  "structured_output": { ... },  // <-- Our ParsedTasksResponse, guaranteed to match schema
  "total_cost_usd": 0.001,
  "duration_ms": 1500,
  "num_turns": 1
}
```

The `structured_output` field contains our `ParsedTasksResponse` with guaranteed schema compliance.

### Node.js Integration Pattern

```typescript
import { spawn } from 'child_process';
import { PARSED_TASKS_SCHEMA } from './schemas';

interface ClaudeResponse {
  session_id: string;
  result: string;
  structured_output: ParsedTasksResponse;  // Guaranteed by --json-schema
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
}

async function parseTasks(
  userInput: string,
  projectContext: string
): Promise<ParsedTasksResponse> {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', `Context:\n${projectContext}\n\nParse these tasks: ${userInput}`,
      '--append-system-prompt-file', './prompts/task-parser.txt',
      '--output-format', 'json',
      '--json-schema', JSON.stringify(PARSED_TASKS_SCHEMA),
      '--max-turns', '1',
      '--tools', ''  // Disable tools - pure text parsing
    ];

    const claude = spawn('claude', args);
    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => { stdout += data; });
    claude.stderr.on('data', (data) => { stderr += data; });

    claude.on('close', (code) => {
      if (code === 0) {
        const response: ClaudeResponse = JSON.parse(stdout);
        resolve(response.structured_output);
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      }
    });
  });
}

// With session management for clarification
class TaskParsingSession {
  private sessionId: string | null = null;

  async parse(userInput: string, context: string): Promise<ParsedTasksResponse> {
    const response = await this.runClaude(userInput, context);
    this.sessionId = response.session_id;
    return response.structured_output;
  }

  async clarify(userClarification: string): Promise<ParsedTasksResponse> {
    if (!this.sessionId) throw new Error('No session started');
    const response = await this.runClaude(
      `User clarification: ${userClarification}`,
      '',
      this.sessionId
    );
    return response.structured_output;
  }

  private async runClaude(
    prompt: string,
    context: string,
    resumeSession?: string
  ): Promise<ClaudeResponse> {
    // Implementation similar to above, with --resume flag if resumeSession provided
  }
}
```

**Key implementation details:**
- Use `structured_output` field from response (guaranteed by `--json-schema`)
- Store `session_id` for multi-turn clarification
- `--tools ""` disables all tools since we're just parsing text
- Context is passed in the prompt itself (or via stdin pipe)

## Target Users

You—a developer working across 5-10 active projects on 2-3 machines, wanting to dump tasks from anywhere (including mobile) without friction.

## Competition & Differentiation

**Alternatives:**
- Manual task entry in Yojimbo (current state)
- Generic todo apps (no project awareness)
- GitHub Issues (per-repo, not cross-project)

**Differentiation:**
- Integrated with Claude Code instances
- Understands your project landscape
- Routes to running instances automatically
- Mobile-friendly voice/text input

## Riskiest Assumptions

1. ~~**CLI output parsing**: Assumes `claude --output-format json` produces reliably parseable output for our structured response schema.~~ **RESOLVED**: `--json-schema` flag enforces our exact schema—output is guaranteed to match.

2. **95% accuracy with pre-loaded context**: Assumes project name + repo name + git history + instance info is enough signal for accurate matching.

3. **Conversational clarification via CLI**: Assumes session resumption (`--resume`) works well enough for 2-3 round clarification.

4. **Subprocess performance**: Assumes CLI startup overhead is acceptable. Research indicates ~1-3 seconds per call, but some sources mention up to 12 seconds for SDK wrapper. Need to benchmark.

5. **Git remote parsing**: Assumes repos have remotes configured and they're parseable.

## MVP Scope

**Phase 1: Basic parsing + matching**
- Build project registry (tracks projects from instances)
- Gather context: project info, instance status, git state
- Invoke `claude` CLI with pre-loaded context
- Parse JSON response into structured tasks
- Show all tasks for review before routing
- Unknown projects shown with picker (no clarification yet)

**Phase 2: Improved matching + README fallback**
- Include recent git commits for recency signals
- Add README snippets for uncertain matches
- Tune prompt for better accuracy

**Phase 3: Multi-turn clarification**
- Implement session resumption or stateless follow-ups
- Conversational clarification for ambiguous tasks
- 2-3 round limit
- UI for clarification flow

## Architecture Decision

### Chosen: CLI Subprocess Approach ✓

Invoke `claude` CLI via subprocess from Yojimbo server.

**Why this approach:**
- ✅ Uses existing Claude Code subscription (no separate API key)
- ✅ No additional billing for users
- ✅ Simpler than SDK integration
- ✅ Works with current Claude Code installation

**Tradeoffs accepted:**
- ⚠️ No dynamic tools (must pre-load all context)
- ⚠️ Subprocess overhead (~1-3s per call)
- ⚠️ Less control over prompts than direct API
- ⚠️ Multi-turn requires session management or stateless workarounds

### Alternatives Considered

**SDK with API Key**: Full control and dynamic tools, but requires separate API key and billing. Rejected to keep it simple for users.

**Direct Anthropic API**: Maximum flexibility, but same billing issue as SDK approach.

### Future Option

If CLI approach proves too limiting (e.g., can't achieve 95% accuracy, multi-turn is clunky), we can add an "Advanced Mode" that uses API key for power users who want better results.

## Open Questions

- [x] ~~Test `claude --output-format json` - does it reliably produce parseable structured output?~~ **RESOLVED**: Use `--json-schema` for guaranteed structure
- [ ] Benchmark CLI startup time - is 1-3s acceptable for UX?
- [ ] Test session resumption (`--resume`) for multi-turn clarification
- [ ] Finalize JSON schema for ParsedTasksResponse
- [ ] Write the task-parser.txt system prompt file
- [ ] Test git remote parsing across different repo configurations
- [ ] Design the clarification UI (conversational input)
- [ ] Decide on caching strategy for project context (how often to refresh git state?)

## Next Steps

1. **Prototype CLI integration** - Test invoking `claude` from Node.js, parse JSON output

2. **Implement project registry** - Database schema is designed, build the actual tables + API

3. **Build context gathering** - Functions to collect project info, instance status, git state

4. **Implement `/api/tasks/parse` endpoint** - Orchestrates context gathering → CLI call → response parsing

5. **Test prompt with real inputs** - Measure accuracy against sample tasks

6. **Build UI** - Connect mockups to the API

---

*Last updated: January 2026*
