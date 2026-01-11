# Feature: Local Keychain Auto-Unlock

> Save local machine's keychain password and auto-unlock on server startup

## Summary

This feature extends the existing remote keychain unlock capability to support local instances. Currently, users can save remote machine keychain passwords in the local macOS Keychain and auto-unlock when starting remote instances. This feature adds the same workflow for the local machine itself.

The password is stored in the macOS Keychain (using the existing `keychainStorageService`) with a special "local" identifier. On server startup, if a password is saved and the keychain is locked, the server attempts auto-unlock. If that fails (wrong password, keychain changed), an SSE event notifies the client to show a password prompt modal.

The settings UI gets a new dedicated "Local Keychain" section where users can save, test, or delete their local keychain password.

## Requirements

### Must Have
- [ ] Store local keychain password in macOS Keychain using existing service
- [ ] Check keychain lock status on server startup
- [ ] Attempt auto-unlock if password is saved and keychain is locked
- [ ] Emit SSE event on unlock failure to trigger client-side prompt
- [ ] Client modal for entering/re-entering local keychain password
- [ ] Settings UI section to manage local keychain password (save/delete/test)

### Should Have
- [ ] "Save to keychain" checkbox in the prompt modal
- [ ] Status indicator in settings showing if keychain is currently unlocked
- [ ] Log messages for debugging (startup unlock attempts, success/failure)

### Out of Scope
- Per-instance keychain unlock (server-wide only)
- Linux/Windows support (macOS only)
- Multiple local keychain support

## Technical Design

### Architecture

```
Server Startup
     │
     ▼
Check: Has stored local password?
     │
     ├── No ──► Continue startup (no auto-unlock)
     │
     ▼ Yes
Check: Is keychain locked? (GET /api/keychain/status)
     │
     ├── No (unlocked) ──► Continue startup
     │
     ▼ Yes (locked)
Attempt unlock with stored password
     │
     ├── Success ──► Continue startup
     │
     ▼ Failure
Emit SSE event: 'local-keychain-unlock-failed'
     │
     ▼
Client receives event ──► Shows LocalKeychainUnlockModal
     │
     ▼
User enters password ──► POST /api/keychain/unlock
     │
     ├── Optionally saves new password
     │
     ▼
Continue
```

### Key Components

**Server:**
1. `server/src/services/local-keychain.service.ts` (new)
   - Wraps keychain storage for local machine (uses "local" as machine ID)
   - Provides `attemptAutoUnlock()` for startup sequence

2. `server/src/routes/keychain.ts` (modify)
   - Add `/api/keychain/local/save` - save local keychain password
   - Add `/api/keychain/local/has-password` - check if password is saved
   - Add `/api/keychain/local/delete` - delete saved password
   - Existing `/api/keychain/unlock` and `/api/keychain/status` are reused

3. `server/src/index.ts` or startup sequence (modify)
   - Call auto-unlock attempt on server startup
   - Emit SSE event on failure

**Client:**
1. `client/src/components/settings/LocalKeychainSection.tsx` (new)
   - Settings UI for local keychain management
   - Shows current status (locked/unlocked, password saved)
   - Save password / delete password / test unlock buttons

2. `client/src/components/modals/LocalKeychainUnlockModal.tsx` (new)
   - Similar to KeychainUnlockModal but simpler (no machine selection)
   - Password field + "Save to keychain" checkbox
   - Triggered by SSE event

3. `client/src/api/client.ts` (modify)
   - Add API methods for local keychain endpoints

4. `client/src/hooks/useSSE.ts` or event handling (modify)
   - Listen for 'local-keychain-unlock-failed' event
   - Trigger modal display

### Data Model

No schema changes. Uses existing keychain storage with:
- **Service name:** `com.yojimbo.remote-keychain` (same service)
- **Account name:** `remote-local` (special ID for local machine)

## Implementation Plan

### Phase 1: Server-side Storage & API
1. Create `local-keychain.service.ts` with save/get/delete/hasPassword methods wrapping `keychainStorageService` with ID "local"
2. Add local keychain API endpoints to `keychain.ts`:
   - `POST /api/keychain/local/save`
   - `GET /api/keychain/local/has-password`
   - `DELETE /api/keychain/local`
3. Add API client methods in `client.ts`

### Phase 2: Startup Auto-Unlock
1. Create `attemptLocalKeychainUnlock()` function
2. Call it in server startup sequence (after DB init, before ready)
3. Add SSE event emission for unlock failure
4. Test startup behavior with/without saved password

### Phase 3: Client Modal
1. Create `LocalKeychainUnlockModal.tsx` (adapt from KeychainUnlockModal)
2. Add SSE event listener for 'local-keychain-unlock-failed'
3. Wire up modal trigger in App.tsx or layout component
4. Test modal flow: event → modal → unlock → save option

### Phase 4: Settings UI
1. Create `LocalKeychainSection.tsx` component
2. Add to settings page above Remote Machines section
3. Include: status display, save password form, delete button, test button
4. Style consistently with existing settings sections

### Phase 5: Polish & Testing
1. Add appropriate logging throughout
2. Handle edge cases (keychain path issues, permission errors)
3. Write tests for new service and endpoints
4. Manual E2E testing of full flow

## Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| No saved password on startup | Skip auto-unlock, continue normally |
| Keychain already unlocked | Skip unlock attempt (check status first) |
| Wrong password stored | Emit SSE event, prompt user to re-enter |
| Keychain not found (non-standard path) | Log error, emit event, prompt user |
| User closes prompt without entering password | Allow dismissal, keychain stays locked |
| Server on non-macOS | All keychain features disabled, section hidden |
| Client not connected when event emits | Store pending unlock state, show on connect |

## Testing Strategy

- **Unit tests:** `local-keychain.service.ts` methods (mock keychain commands)
- **API tests:** New keychain endpoints in `keychain.test.ts`
- **E2E tests:** Settings section interactions, modal flow
- **Manual testing:** Full startup sequence, password save/delete, unlock success/failure

## Open Questions

- [ ] Should we add a "Test unlock" button in settings (useful for verifying password before relying on auto-unlock)?
- [ ] Rate limiting on unlock attempts to prevent brute-force?

## Design Decisions Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Reuse keychainStorageService with "local" ID | Consistent pattern, less code duplication | Separate service, env variable |
| SSE event for unlock failure | Real-time notification, existing SSE infra | Polling, delay until first instance |
| Check status before unlock | Avoid unnecessary operations | Always attempt (idempotent) |
| Settings section vs. embedded | Clear discoverability, dedicated space | Inline with Remote Machines |
| No separate enable toggle | Simpler mental model (save = enabled) | Explicit on/off toggle |
