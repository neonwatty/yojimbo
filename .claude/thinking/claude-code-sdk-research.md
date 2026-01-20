# Claude Code SDK/API Research Summary

> Research conducted January 2026 on programmatic access to Claude Code capabilities.

## Executive Summary

The **Claude Code SDK has been renamed to Claude Agent SDK**. It provides full programmatic access to Claude Code's capabilities including custom tools, function calling, and flexible authentication. This addresses all of the questions raised in the smart-tasks-api-integration.md document.

**Key Finding**: The SDK fully supports custom tools via MCP servers (including in-process SDK MCP servers), making it suitable for the Smart Tasks API integration use case.

---

## 1. What Programmatic API Does Claude Code Expose?

### Available APIs

The Claude Agent SDK provides two main interfaces:

#### `query()` Function (Simple)
```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Find and fix the bug in auth.py",
    options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"])
):
    print(message)
```

#### `ClaudeSDKClient` (Advanced)
```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async with ClaudeSDKClient(options=options) as client:
    await client.query("Your prompt here")
    async for msg in client.receive_response():
        print(msg)
```

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **Built-in Tools** | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, AskUserQuestion |
| **Sessions** | Resume/fork conversations with full context |
| **Subagents** | Spawn specialized agents for subtasks |
| **MCP Integration** | Connect to external systems via Model Context Protocol |
| **Hooks** | Run custom code at key points (PreToolUse, PostToolUse, Stop, etc.) |
| **Permissions** | Fine-grained control over tool access |

### SDK Packages

- **Python**: `pip install claude-agent-sdk` (Python 3.10+)
- **TypeScript**: `npm install @anthropic-ai/claude-agent-sdk` (Node.js 18+)
- **CLI Mode**: `claude -p "prompt" --output-format json`

---

## 2. Custom Tools / Function Calling Support

**Yes, the SDK fully supports custom tools.**

### Option A: SDK MCP Servers (In-Process, Recommended)

Define tools as Python/TypeScript functions that run in the same process:

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeAgentOptions, ClaudeSDKClient

@tool("get_instance_status", "Get status of running instances", {"instance_id": str})
async def get_instance_status(args):
    # Your implementation
    return {
        "content": [{"type": "text", "text": f"Instance {args['instance_id']} is idle"}]
    }

server = create_sdk_mcp_server(
    name="yojimbo-tools",
    version="1.0.0",
    tools=[get_instance_status]
)

options = ClaudeAgentOptions(
    mcp_servers={"tools": server},
    allowed_tools=["mcp__tools__get_instance_status"]
)

async with ClaudeSDKClient(options=options) as client:
    await client.query("Check the status of instance-123")
```

**Benefits of SDK MCP Servers:**
- No subprocess management
- Better performance (no IPC overhead)
- Simpler deployment
- Easier debugging
- Type safety with direct Python function calls

### Option B: External MCP Servers (Subprocess)

```python
options = ClaudeAgentOptions(
    mcp_servers={
        "playwright": {"command": "npx", "args": ["@playwright/mcp@latest"]}
    }
)
```

### Option C: Programmatic Tool Calling (PTC)

For high-volume tool operations, PTC allows Claude to write Python scripts that call tools programmatically, reducing context window impact:

```python
# Enable PTC on custom tools
tool_definition = {
    "name": "search_projects",
    "allowed_callers": ["direct", "code_execution_20250825"],
    # ... rest of tool definition
}
```

**PTC Benefits:**
- Tool results don't count toward input/output token usage
- Only final processed output goes to Claude's context
- Better for operations like reading thousands of rows

---

## 3. Authentication Options

### Primary: Anthropic API Key (Recommended)

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Get key from: https://platform.claude.com/

### Alternative: Third-Party Providers

| Provider | Environment Variables |
|----------|----------------------|
| Amazon Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` + AWS credentials |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` + GCP credentials |
| Microsoft Foundry | `CLAUDE_CODE_USE_FOUNDRY=1` + Azure credentials |

### Important Restrictions

> **Unless previously approved, Anthropic does not allow third party developers to offer Claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK.**

This means:
- Cannot use Claude.ai consumer subscription for products you build
- Cannot leverage existing Claude Code OAuth tokens for third-party apps
- Must use API key authentication for production applications

### For Yojimbo Integration

Since Yojimbo already uses Claude Code, we have two paths:

1. **User provides their own API key** (simplest, most flexible)
2. **Use existing Claude Code CLI** via subprocess (limited control)

---

## 4. Prompt Customization & Limitations

### System Prompt Options

| Method | Persistence | Full Tools | Best For |
|--------|-------------|------------|----------|
| **CLAUDE.md files** | Per-project file | Preserved | Team-shared context, coding standards |
| **Output Styles** | Saved as files | Preserved | Reusable configs across projects |
| **`systemPrompt` with append** | Session only | Preserved | Session-specific additions |
| **Custom `systemPrompt`** | Session only | Lost (unless included) | Complete control |

### Using Claude Code Preset

```python
options = ClaudeAgentOptions(
    system_prompt={
        "type": "preset",
        "preset": "claude_code",  # Full Claude Code system prompt
        "append": "Additional custom instructions here"
    },
    setting_sources=["project"]  # Required to load CLAUDE.md
)
```

### Using Fully Custom Prompt

```python
options = ClaudeAgentOptions(
    system_prompt="""You are a task routing specialist.
    Given free-form task input, parse it into discrete tasks
    and match each to the most appropriate project."""
)
```

### Limitations

1. **CLAUDE.md Loading**: Must explicitly set `setting_sources=["project"]` - not automatic even with `claude_code` preset.

2. **Skills via SDK**: The `allowed-tools` frontmatter in SKILL.md files only works with CLI, not SDK. Control tools via `allowedTools` option instead.

3. **Skills Registration**: Skills must be filesystem artifacts (`.claude/skills/SKILL.md`). No programmatic API for registering Skills.

4. **Permission Inheritance**: With `bypassPermissions`, all subagents inherit this mode and cannot be overridden.

5. **Token Limits**: Standard Claude API token limits apply.

6. **Rate Limits**: Subject to API rate limits based on your plan.

---

## 5. Relevance to Smart Tasks Feature

Based on the `.claude/thinking/smart-tasks-api-integration.md` document, here's how the SDK addresses the use case:

### Architecture Recommendation

```
Client (raw text) --> Yojimbo Server --> Claude Agent SDK
                                              |
                                              v
                                      Custom MCP Tools:
                                      - get_instance_status
                                      - get_git_state
                                      - get_readme
```

### Implementation Approach

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeAgentOptions, ClaudeSDKClient

# Define tools
@tool("get_instance_status", "Get running instance statuses", {})
async def get_instance_status(args):
    # Call Yojimbo's internal API
    instances = await yojimbo_api.get_instances()
    return {"content": [{"type": "text", "text": json.dumps(instances)}]}

@tool("get_git_state", "Get git state for a project", {"project_id": str})
async def get_git_state(args):
    state = await yojimbo_api.get_git_state(args["project_id"])
    return {"content": [{"type": "text", "text": json.dumps(state)}]}

@tool("get_readme", "Get README content for a project", {"project_id": str})
async def get_readme(args):
    content = await yojimbo_api.get_readme(args["project_id"])
    return {"content": [{"type": "text", "text": content}]}

# Create server
tools_server = create_sdk_mcp_server(
    name="yojimbo-task-tools",
    version="1.0.0",
    tools=[get_instance_status, get_git_state, get_readme]
)

# Configure SDK
options = ClaudeAgentOptions(
    system_prompt="""You are a task parsing and routing specialist.

    Given free-form task input:
    1. Parse into discrete tasks
    2. Match each task to a project using available context
    3. Use tools to gather more information when uncertain
    4. Return structured ParsedTasksResponse
    """,
    mcp_servers={"tools": tools_server},
    allowed_tools=[
        "mcp__tools__get_instance_status",
        "mcp__tools__get_git_state",
        "mcp__tools__get_readme"
    ],
    max_turns=5  # Limit for clarification rounds
)
```

### Answering the Open Questions

| Question | Answer |
|----------|--------|
| SDK supports custom tools? | **Yes** - via SDK MCP servers (in-process) |
| Can make Anthropic API calls with tools? | **Yes** - full function calling support |
| Can leverage existing Claude Code auth? | **No** - must use separate API key |
| Limitations on prompt customization? | **Minimal** - full control with custom `systemPrompt` |
| Limitations on tool definitions? | **None significant** - standard MCP tool schema |

---

## 6. Direction Recommendation

Based on this research, **Direction 1 (Claude Agent SDK Integration)** is the recommended path:

### Why SDK over Direct API

1. **Built-in agent loop** - No need to implement tool execution loops
2. **Context management** - Automatic compaction and session handling
3. **Production features** - Error handling, monitoring, prompt caching
4. **Consistent architecture** - Same foundation as Claude Code itself

### Why API Key over Claude Code Auth

1. **Required by TOS** - Third-party apps cannot use Claude.ai login
2. **Better control** - Direct billing, rate limit management
3. **Simpler deployment** - No dependency on user's Claude Code installation

### Implementation Phases

1. **Phase 1**: Basic SDK integration with custom tools
2. **Phase 2**: Add multi-turn clarification via `AskUserQuestion` tool
3. **Phase 3**: Optimize with Programmatic Tool Calling for batch operations

---

## References

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK Python](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude Agent SDK TypeScript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Modifying System Prompts](https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts)
- [Configure Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [Programmatic Tool Calling](https://platform.claude.com/docs/en/agents-and-tools/tool-use/programmatic-tool-calling)
- [Example Agents](https://github.com/anthropics/claude-agent-sdk-demos)

---

*Last updated: January 2026*
