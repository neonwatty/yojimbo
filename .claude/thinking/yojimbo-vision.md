# Yojimbo Future Vision

## Think-Through Summary

This document captures the vision for Yojimbo's evolution from a multi-instance Claude Code orchestrator to a "work from anywhere" task orchestration system.

## Vision Statement

**From brain dump to autonomous execution**: Input tasks (by voice or text) from anywhere, have Claude parse and interpret them, route them to appropriate Claude Code instances, approve execution with minimal friction, and let work happen autonomously.

## Target User Profile

- **Primary user**: You (personal productivity tool, not a product for others)
- **Scale**: 2-3 machines on local network
- **Access pattern**: Accessed remotely via Tailscale
- **Core workflow**: Mobile-first task capture, desktop execution

## Core Value Proposition

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Voice/Text    │────▶│  Claude Parses  │────▶│    Clarify      │
│     Input       │     │    into Tasks   │     │   Ambiguous     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Execution    │◀────│ Approve Routing │◀────│ Claude Suggests │
│    Starts       │     │  (Swipe/Click)  │     │    Routing      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Priority Order

1. **Foundation** - Reliable remote access (Tailscale connectivity, health monitoring)
2. **Voice Input** - Natural task capture without typing
3. **Smart Routing** - Claude-powered task parsing and instance matching
4. **Mobile UX** - Optimized approval flows for phone usage

## User Flow Breakdown

### 1. Task Input (Voice or Text)

**Key interactions:**
- Hold-to-record voice button for hands-free capture
- Text area for paste/type workflows
- Support for multiple tasks in a single input
- Natural language processing by Claude

**Example inputs:**
- "Fix the auth bug, add dark mode, and improve API performance"
- Pasted meeting notes with action items
- Screenshot with annotations (future)

### 2. Claude Parsing

**What Claude does:**
- Identifies discrete tasks from free-form input
- Infers project context from task content
- Categorizes task type (bug fix, feature, enhancement, refactor)
- Assesses clarity level (ready vs. needs clarification)

**Clarity assessment:**
- **Clear**: Has enough context to route and execute
- **Ambiguous**: Needs user clarification before routing

### 3. Clarification Flow

**For ambiguous tasks:**
- Claude generates clarifying questions
- User provides quick answers (text input or quick-select options)
- Task clarity is upgraded after clarification

**Example:**
- Task: "Add dark mode to settings"
- Question: "Which settings? App settings or instance settings?"
- Answer: "App settings theme toggle"

### 4. Routing Approval

**Core concept: Swipe-to-approve**
- One task at a time for focused decision making
- Claude suggests best-match instance with confidence score
- Shows instance context (current project, status, machine)
- Alternative options visible but not prominent

**Routing options:**
- Existing idle instance (highest match)
- Existing working instance (queue task)
- Create new instance (specify machine + directory)

**Gestures (mobile-optimized):**
- Swipe right: Approve with suggested routing
- Swipe left: Skip task
- Tap alternative: Choose different routing

### 5. Execution Confirmation

**After approval:**
- Visual confirmation of dispatched tasks
- Status indicators (Started, Queued, Starting)
- Notification opt-in for completion alerts
- Quick link back to instance view

## Connection Health System

### Purpose

Validate and troubleshoot the multi-machine setup to ensure reliable task dispatch.

### Health Checks

For each machine:
1. **Server connection** - Can we reach the Yojimbo server?
2. **Hooks installed** - Are Claude Code hooks set up?
3. **Status updates** - Are we receiving real-time status?
4. **Last heartbeat** - How fresh is our connection?

### States

- **Healthy**: All checks pass, ready for task dispatch
- **Setup Required**: Missing hooks or configuration
- **Disconnected**: Cannot reach machine
- **Degraded**: Some features unavailable

### Actions

- Install hooks remotely (via SSH)
- Run full connection test
- View troubleshooting guide
- Check server logs

## Technical Considerations

### Voice Input Options

| Option | Pros | Cons |
|--------|------|------|
| Browser Web Speech API | Zero setup, built-in | Limited accuracy, requires online |
| Whisper (local) | High accuracy, offline | Requires model setup, CPU/GPU |
| Whisper (API) | High accuracy, no local setup | Requires API key, costs |

**Recommendation**: Start with Web Speech API for simplicity, add Whisper option later.

### Task Queue Behavior

When target instance is busy:
- **Option A**: Queue task on instance (sequential)
- **Option B**: Wait for idle before dispatch
- **Option C**: User chooses per-task

**Recommendation**: Default to queue, show queue position in UI.

### Notifications

| Platform | Mechanism |
|----------|-----------|
| Web | Web Push API (requires service worker) |
| iOS | PWA push (limited) or native app wrapper |
| Desktop | Native notifications (Electron) |

### Offline Behavior

- Cache pending tasks locally
- Sync when connection restored
- Clear indicator when offline
- Queue voice recordings for processing

## Open Questions

- [ ] Voice input: Native browser API or Whisper integration?
- [ ] Task queuing: If an instance is busy, queue or wait for idle?
- [ ] Notifications: Push notifications when tasks complete (iOS/web)?
- [ ] Offline: What happens if you lose connection mid-flow?
- [ ] History: Should we show task history and completion status?
- [ ] Templates: Pre-defined task patterns for common workflows?

## Mockup Files

| File | Description |
|------|-------------|
| `mockups/smart-tasks-flow.html` | Interactive mockup of the complete task input → routing flow |
| `mockups/connection-health.html` | Interactive mockup of connection health and validation UI |

## Next Steps

1. Review mockups in browser (desktop and mobile viewports)
2. Walk through each flow step by step
3. Identify missing states or edge cases
4. Get feedback and iterate on designs
5. Prioritize which screens to implement first
6. Begin React component implementation

---

*Last updated: January 2025*
