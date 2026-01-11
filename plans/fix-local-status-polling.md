# Fix Local Instance Status Polling

## Problem
Local instances always show "idle" even when Claude Code is working.

## Root Cause
Path encoding bug in `server/src/services/local-status-poller.service.ts:93`

```javascript
// BUG: Incorrectly strips leading dash
const encodedDir = expandedDir.replace(/\//g, '-').replace(/^-/, '');
```

- Code looks for: `Users-jeremywatt-Desktop-...`
- Claude creates: `-Users-jeremywatt-Desktop-...`

## Fix
Remove `.replace(/^-/, '')` from line 93.

## Files
- `server/src/services/local-status-poller.service.ts`
