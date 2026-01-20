# Claude Code CLI Capabilities for Programmatic/Automated Usage

> **Research Date**: January 19, 2026
> **Claude Code Version**: Current stable (as of `claude --help` output)
> **Purpose**: Feature planning for invoking `claude` CLI from a Node.js server to parse tasks

---

## Table of Contents

1. [Output Formats](#1-output-formats)
2. [Non-Interactive Mode](#2-non-interactive-mode)
3. [Session Management](#3-session-management)
4. [System Prompts](#4-system-prompts)
5. [Context and Input Methods](#5-context-and-input-methods)
6. [Model Selection](#6-model-selection)
7. [Max Tokens/Turns Limits](#7-max-tokensturns-limits)
8. [MCP Server Attachment](#8-mcp-server-attachment)
9. [Permissions Handling](#9-permissions-handling)
10. [Error Handling and Exit Codes](#10-error-handling-and-exit-codes)
11. [Node.js Integration Patterns](#11-nodejs-integration-patterns)
12. [Complete Flag Reference](#12-complete-flag-reference)

---

## 1. Output Formats

### Available Options (`--output-format`)

| Format | Description | Use Case |
|--------|-------------|----------|
| `text` | Human-readable plain text (default) | Interactive/manual usage |
| `json` | Single structured JSON object with metadata | Programmatic parsing, CI/CD |
| `stream-json` | Newline-delimited JSON (NDJSON) for real-time streaming | Agent pipelines, live processing |

### JSON Output Structure

When using `--output-format json`, the response structure is:

```json
{
  "session_id": "uuid-here",
  "result": "The text response from Claude",
  "messages": [
    {
      "type": "assistant",
      "content": [{"type": "text", "text": "..."}]
    }
  ],
  "total_cost_usd": 0.001,
  "duration_ms": 1500,
  "num_turns": 2
}
```

**Note**: For structured data extraction, the actual Claude response may be nested within `result.content[0].text` and needs to be parsed separately.

### Structured Output with JSON Schema

Use `--json-schema` to enforce specific output structure:

```bash
claude -p "Extract the main function names from auth.py" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"functions":{"type":"array","items":{"type":"string"}}},"required":["functions"]}'
```

The structured output appears in the `structured_output` field of the response.

### Stream-JSON Format

For real-time streaming, `stream-json` emits newline-delimited JSON with every token, turn, and tool interaction:

```bash
claude -p "Large analysis" --output-format stream-json
```

Use `--include-partial-messages` to include partial message chunks as they arrive:

```bash
claude -p "query" --output-format stream-json --include-partial-messages
```

### Parsing Examples

```bash
# Extract text result
claude -p "Summarize this project" --output-format json | jq -r '.result'

# Extract session ID for later resumption
session_id=$(claude -p "Start review" --output-format json | jq -r '.session_id')

# Extract structured output
claude -p "Extract functions" --output-format json --json-schema '...' | jq '.structured_output'
```

---

## 2. Non-Interactive Mode

### The `-p` / `--print` Flag

The primary mechanism for non-interactive execution:

```bash
claude -p "Your prompt here"
claude --print "Your prompt here"
```

**Key Behaviors:**
- Executes a single prompt and exits
- No interactive prompts or REPL
- Workspace trust dialog is skipped (only use in trusted directories)
- Does not persist session by default (can override)
- Ideal for scripting, CI/CD, and automation

### Combining with Output Format

```bash
# Human-readable output
claude -p "Analyze code quality" --output-format text

# JSON for parsing
claude -p "Generate report" --output-format json

# Real-time streaming
claude -p "Large analysis" --output-format stream-json
```

### Headless Mode Characteristics

- Does not persist sessions by default
- All tool interactions must be pre-approved via `--allowedTools`
- Output is formatted for programmatic consumption
- Use descriptive task prompts instead of slash commands

---

## 3. Session Management

### Continue Most Recent Session (`--continue` / `-c`)

```bash
# Initial task
claude -p "Review this codebase for performance issues"

# Continue in same session
claude -p "Now focus on the database queries" --continue
```

### Resume Specific Session (`--resume` / `-r`)

```bash
# Capture session ID from JSON output
session_id=$(claude -p "Start review" --output-format json | jq -r '.session_id')

# Resume that specific session later
claude -p "Continue that review" --resume "$session_id"

# Or resume with search term (interactive picker)
claude --resume "auth-refactor" "Finish this PR"
```

### Session ID Control

```bash
# Use a specific session ID (must be valid UUID)
claude --session-id "550e8400-e29b-41d4-a716-446655440000" -p "query"

# Fork session when resuming (create new ID from existing conversation)
claude --resume abc123 --fork-session -p "Continue with new branch"
```

### Disable Session Persistence

```bash
# For one-off tasks that shouldn't be saved
claude -p "Quick analysis" --no-session-persistence
```

---

## 4. System Prompts

### Options Overview

| Flag | Behavior | Works With |
|------|----------|------------|
| `--system-prompt` | **Replaces** entire default prompt | Interactive + Print |
| `--system-prompt-file` | **Replaces** with file contents | Print only |
| `--append-system-prompt` | **Appends** to default prompt | Interactive + Print |
| `--append-system-prompt-file` | **Appends** file contents | Print only |

**Note**: `--system-prompt` and `--system-prompt-file` are mutually exclusive.

### Usage Examples

```bash
# Replace entire system prompt
claude --system-prompt "You are a Python expert who only writes type-annotated code"

# Append instructions (recommended - preserves Claude Code's built-in capabilities)
claude --append-system-prompt "Always use TypeScript and include JSDoc comments"

# Load from file
claude -p --system-prompt-file ./custom-prompt.txt "query"

# Append from file (best for reproducibility)
claude -p --append-system-prompt-file ./style-rules.txt "Review this PR"
```

### CLAUDE.md Configuration

Claude Code automatically reads `CLAUDE.md` files at session start:

**File Locations (hierarchical loading):**
1. `~/.claude/CLAUDE.md` - Global (all projects)
2. `./CLAUDE.md` - Project root (most common)
3. `./.claude/CLAUDE.md` - Alternative subdirectory location

**What to Include:**
- Build/test/deploy commands
- Project-specific warnings and gotchas
- Code style requirements
- Architecture notes

**Generate Starter File:**
```bash
# Run /init command in interactive mode to generate CLAUDE.md
claude
> /init
```

---

## 5. Context and Input Methods

### Piping Input via stdin

```bash
# Pipe file contents
cat myfile.py | claude -p "Review this code"

# Pipe git diff
git diff HEAD~1 | claude -p "Summarize these changes"

# Pipe command output
gh pr diff "$1" | claude -p "Review for security vulnerabilities"
```

### Stream-JSON Input Format

For continuous conversation simulation:

```bash
claude -p --input-format stream-json --output-format stream-json
```

Use `--replay-user-messages` to re-emit user messages from stdin back on stdout:

```bash
claude -p --input-format stream-json --output-format stream-json --replay-user-messages
```

### Additional Directories

```bash
# Grant tool access to additional directories
claude --add-dir ../apps ../lib -p "Analyze cross-project dependencies"
```

### File Resources at Startup

```bash
# Download file resources at startup
claude --file file_abc:doc.txt file_def:img.png -p "Review these files"
```

---

## 6. Model Selection

### The `--model` Flag

```bash
# Use model alias
claude --model sonnet -p "query"
claude --model opus -p "query"

# Use full model name
claude --model claude-sonnet-4-5-20250929 -p "query"
```

### Fallback Model

Automatic fallback when default model is overloaded (print mode only):

```bash
claude -p --fallback-model sonnet "query"
```

### Available Model Aliases

- `sonnet` - Claude Sonnet (latest)
- `opus` - Claude Opus (latest)
- Full model identifiers also supported

---

## 7. Max Tokens/Turns Limits

### `--max-turns` Flag

Limits autonomous actions in non-interactive mode:

```bash
# Single turn
claude -p "Quick analysis" --max-turns 1

# Limited multi-turn
claude -p "Fix linting errors" --max-turns 3

# Combine with verbose for debugging
claude -p "Debug authentication" --max-turns 2 --verbose
```

**Behavior**: Exits with error at limit if task isn't complete.

### `--max-budget-usd` Flag

Maximum spend on API calls (print mode only):

```bash
claude -p "Extensive analysis" --max-budget-usd 5.00
```

---

## 8. MCP Server Attachment

### `--mcp-config` Flag

Load MCP servers from JSON files or strings:

```bash
# From file
claude --mcp-config ./mcp.json -p "query"

# From JSON string
claude --mcp-config '{"servers":[...]}' -p "query"
```

### Strict MCP Configuration

Only use servers from `--mcp-config`, ignoring all other MCP configurations:

```bash
claude --strict-mcp-config --mcp-config ./mcp.json -p "query"
```

### MCP CLI Commands

```bash
# Add MCP server
claude mcp add github --scope user

# Add with JSON configuration
claude mcp add-json github '{"command":"npx","args":["-y","@modelcontextprotocol/server-github"],"env":{"GITHUB_PERSONAL_ACCESS_TOKEN":"'$GITHUB_TOKEN'"}}'

# List configured servers
claude mcp list

# Test server
claude mcp get github

# Remove server
claude mcp remove github
```

### Configuration Scopes

- `local` (default) - Available only to you in current project
- `project` - Shared with everyone via `.mcp.json` file
- `user` - Available across all projects

---

## 9. Permissions Handling

### Permission Modes

| Flag | Description |
|------|-------------|
| `--dangerously-skip-permissions` | Bypass ALL permission checks |
| `--allow-dangerously-skip-permissions` | Enable bypass option without activating |
| `--permission-mode <mode>` | Set specific permission mode |

**Permission Modes:**
- `default` - Normal permission prompts
- `acceptEdits` - Auto-accept file edits
- `bypassPermissions` - Bypass all prompts
- `delegate` - Delegate to external tool
- `dontAsk` - Don't ask for any permissions
- `plan` - Planning mode

### `--allowedTools` Flag

Granular tool approval without prompting:

```bash
# Basic tool approval
claude -p "Run tests and fix failures" --allowedTools "Bash,Read,Edit"

# Prefix-matching for specific commands
claude -p "Create a commit" --allowedTools "Bash(git diff:*),Bash(git log:*),Bash(git status:*),Bash(git commit:*)"

# Research-only (safe)
claude -p "Analyze codebase" --allowedTools "Read(*),Grep(*)"
```

The `:*` suffix enables prefix matching.

### `--disallowedTools` Flag

Remove specific tools from context:

```bash
claude -p "query" --disallowedTools "Bash(rm:*),Edit"
```

### `--tools` Flag

Restrict available built-in tools:

```bash
# Only allow specific tools
claude --tools "Bash,Edit,Read" -p "query"

# Disable all tools
claude --tools "" -p "query"

# Use all tools (default)
claude --tools "default" -p "query"
```

### Safety Recommendations

**For `--dangerously-skip-permissions`:**
- Only use in isolated, sandboxed environments
- Preferably use Docker containers without internet access
- Configure `AllowedTools` whitelist even when bypassing permissions
- Never use for general development

---

## 10. Error Handling and Exit Codes

### Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| `0` | Success | Execution completed successfully |
| `1` | General failure | Check configuration, API key, network |
| `2` | Blocking error | Critical halt (used by hooks) |
| `127` | Command not found | CLI/spawn chain issue |
| Other non-zero | Non-blocking error | Execution continues with error message |

### Common Causes of Exit Code 1

- Missing or invalid API key
- Network problems (DNS, proxy, firewall)
- Outdated Node.js version
- Invalid config files (JSON syntax errors)
- VPN/proxy blocking API requests

### Programmatic Error Detection

```javascript
const { spawn } = require('child_process');

const claude = spawn('claude', ['-p', 'query', '--output-format', 'json']);

claude.on('close', (code) => {
  if (code === 0) {
    console.log('Success');
  } else if (code === 1) {
    console.error('General failure - check configuration');
  } else if (code === 2) {
    console.error('Critical blocking error');
  }
});
```

### JSON Error Detection

When using `--output-format json`, check for error fields:

```json
{
  "type": "result",
  "subtype": "error_max_turns",
  "data": { ... }
}
```

**Result Subtypes:**
- `success` - Task completed
- `error_max_turns` - Max turns limit reached
- `error_during_execution` - Error occurred during execution

---

## 11. Node.js Integration Patterns

### Basic Spawning

```javascript
const { spawn } = require('child_process');

async function runClaude(prompt, options = {}) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', 'json'];

    if (options.allowedTools) {
      args.push('--allowedTools', ...options.allowedTools);
    }
    if (options.maxTurns) {
      args.push('--max-turns', options.maxTurns.toString());
    }
    if (options.model) {
      args.push('--model', options.model);
    }

    const claude = spawn('claude', args, {
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    });

    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => { stdout += data; });
    claude.stderr.on('data', (data) => { stderr += data; });

    claude.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${stdout}`));
        }
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      }
    });
  });
}

// Usage
const result = await runClaude('Analyze this code for security issues', {
  allowedTools: ['Read', 'Grep'],
  maxTurns: 5,
  cwd: '/path/to/project'
});
console.log(result.result);
```

### Session Management Pattern

```javascript
class ClaudeSession {
  constructor(options = {}) {
    this.sessionId = null;
    this.options = options;
  }

  async start(prompt) {
    const result = await runClaude(prompt, {
      ...this.options,
      outputFormat: 'json'
    });
    this.sessionId = result.session_id;
    return result;
  }

  async continue(prompt) {
    if (!this.sessionId) {
      throw new Error('No session started');
    }
    return runClaude(prompt, {
      ...this.options,
      resume: this.sessionId
    });
  }
}
```

### Streaming Pattern

```javascript
const { spawn } = require('child_process');
const readline = require('readline');

function streamClaude(prompt, onMessage) {
  const claude = spawn('claude', [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--include-partial-messages'
  ]);

  const rl = readline.createInterface({ input: claude.stdout });

  rl.on('line', (line) => {
    try {
      const message = JSON.parse(line);
      onMessage(message);
    } catch (e) {
      console.error('Failed to parse:', line);
    }
  });

  return new Promise((resolve, reject) => {
    claude.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Exit code ${code}`));
    });
  });
}
```

### Official TypeScript SDK

For production usage, consider the official Agent SDK:

```typescript
import { claudeCode } from '@anthropic-ai/claude-code';

async function main() {
  const result = await claudeCode({
    prompt: 'Write a TypeScript interface for a User',
    allowedTools: ['Read', 'Edit'],
    maxTurns: 5
  });
  console.log(result.stdout);
}
```

**Note**: The SDK has a ~12 second startup overhead per call due to process spawning. For real-time applications, consider batching or alternative approaches.

---

## 12. Complete Flag Reference

### Core Flags

| Flag | Description |
|------|-------------|
| `-p, --print` | Print response and exit (non-interactive) |
| `-c, --continue` | Continue most recent conversation |
| `-r, --resume [value]` | Resume by session ID or search |
| `-v, --version` | Output version number |
| `-h, --help` | Display help |

### Output/Input Flags

| Flag | Description |
|------|-------------|
| `--output-format <format>` | `text`, `json`, `stream-json` |
| `--input-format <format>` | `text`, `stream-json` |
| `--include-partial-messages` | Include partial chunks in stream |
| `--json-schema <schema>` | JSON Schema for structured output |

### Model Flags

| Flag | Description |
|------|-------------|
| `--model <model>` | Model alias or full name |
| `--fallback-model <model>` | Fallback when overloaded |

### System Prompt Flags

| Flag | Description |
|------|-------------|
| `--system-prompt <prompt>` | Replace system prompt |
| `--system-prompt-file <file>` | Replace from file |
| `--append-system-prompt <prompt>` | Append to default |
| `--append-system-prompt-file <file>` | Append from file |

### Limit Flags

| Flag | Description |
|------|-------------|
| `--max-turns <n>` | Limit autonomous turns |
| `--max-budget-usd <amount>` | Maximum API spend |

### Permission Flags

| Flag | Description |
|------|-------------|
| `--dangerously-skip-permissions` | Bypass all permission checks |
| `--allow-dangerously-skip-permissions` | Enable bypass option |
| `--permission-mode <mode>` | Set permission mode |
| `--allowedTools <tools...>` | Tools allowed without prompting |
| `--disallowedTools <tools...>` | Tools to deny |
| `--tools <tools...>` | Restrict available tools |

### MCP Flags

| Flag | Description |
|------|-------------|
| `--mcp-config <configs...>` | Load MCP servers |
| `--strict-mcp-config` | Only use --mcp-config servers |

### Session Flags

| Flag | Description |
|------|-------------|
| `--session-id <uuid>` | Use specific session ID |
| `--fork-session` | Create new ID when resuming |
| `--no-session-persistence` | Don't save session |

### Advanced Flags

| Flag | Description |
|------|-------------|
| `--agents <json>` | Define custom subagents |
| `--agent <agent>` | Specify agent for session |
| `--settings <file-or-json>` | Load additional settings |
| `--add-dir <directories...>` | Additional tool access directories |
| `--debug [filter]` | Enable debug mode |
| `--verbose` | Verbose logging |

---

## Sources and References

### Official Documentation
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Run Claude Code Programmatically](https://code.claude.com/docs/en/headless)
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)

### Community Resources
- [Claude Code Cheatsheet - Shipyard](https://shipyard.build/blog/claude-code-cheat-sheet/)
- [Claude Code Cheatsheet - GitHub](https://github.com/Njengah/claude-code-cheat-sheet)
- [Stream-JSON Chaining Wiki](https://github.com/ruvnet/claude-flow/wiki/Stream-Chaining)

### Troubleshooting
- [Claude Code Troubleshooting](https://code.claude.com/docs/en/troubleshooting)
- [Exit Code 1 Fixes](https://www.webfactoryltd.com/blog/fix-claude-code-exit-code-1-error/)

### SDKs
- [Official TypeScript SDK](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Community claude-code-js](https://github.com/s-soroosh/claude-code-js)
