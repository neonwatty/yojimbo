# Smart Tasks Practice Tests

This directory contains test prompts and utilities for manually testing the Smart Tasks feature.

## Test Prompts

### `multi-repo-status-check.txt`
Tests parsing tasks that mention both known and unknown repositories:
- **BugDrop** - Not registered locally, but exists on GitHub
- **Yojimbo** - Registered locally

Expected behavior:
1. Parser finds 2 tasks
2. BugDrop task shows "Unknown project" badge (yellow)
3. Yojimbo task shows "Ready" badge (green) with 95% confidence
4. "Clone & Create" button appears in footer
5. Clarification question shows GitHub repo info for BugDrop

## Running the Test

### Prerequisites
- Dev server running (`make dev` or `npm run dev`)
- GitHub CLI authenticated (`gh auth status`)

### Quick Start (Makefile)

```bash
# Clean up test data and show test instructions
make smart-test

# Just clean up test data
make smart-cleanup

# Copy test prompt to clipboard (macOS)
make smart-prompt
```

### Manual Steps

1. **Start fresh** (optional):
   ```bash
   make smart-cleanup
   # or
   ./practice-tasks/cleanup-test-data.sh
   ```

2. **Open the app**: http://localhost:5173

3. **Open Tasks modal**: Click "Tasks" in the nav bar

4. **Click "Smart"** to open Smart Task Input

5. **Enter the test prompt**:
   ```
   Let's do the following: 1. Check for any open PRs on BugDrop 2. Check the current status of any issues in the Yojimbo repo
   ```

6. **Click "Parse Tasks"** and wait for parsing

7. **Verify the UI**:
   - [ ] BugDrop task has yellow "Unknown project" badge
   - [ ] Yojimbo task has green "Ready" badge
   - [ ] "Clone & Create" button is visible
   - [ ] Summary shows "1 ready to route • 1 needs clarification"

8. **Test Clone flow**:
   - Click "Clone & Create"
   - Verify form auto-fills from detected repo
   - Enter: `https://github.com/neonwatty/bugdrop`
   - Click "Clone & Create Instance"
   - Verify instance is created

9. **Cleanup** (to repeat the test):
   ```bash
   make smart-cleanup
   ```

## Test Scenarios

### Scenario: Multiple Project Matches (ProjectSelector dropdown)
To test the project dropdown selector, you need multiple registered projects that could match a task:

1. Register multiple worktrees of the same repo as separate projects
2. Enter a task that could match either
3. The ProjectSelector should show a dropdown with both options

### Scenario: Unknown Project with GitHub Lookup
1. Mention a repo that exists on your GitHub but isn't registered locally
2. Parser should search GitHub and include repo info in clarification question
3. "Clone & Create" button should appear

### Scenario: Completely Unknown Project
1. Mention a repo that doesn't exist anywhere
2. Should show "Unknown project" with generic clarification
3. User can manually enter repo URL in Clone modal
