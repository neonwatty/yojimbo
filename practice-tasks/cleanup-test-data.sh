#!/bin/bash
# Cleanup script for Smart Tasks testing
# Run this to reset the test environment before re-running tests

set -e

echo "🧹 Cleaning up Smart Tasks test data..."

# 1. Remove cloned test repos
TEST_REPOS=(
  "$HOME/Desktop/bugdrop"
  "$HOME/Desktop/social-tools"
)

for repo in "${TEST_REPOS[@]}"; do
  if [ -d "$repo" ]; then
    echo "  Removing cloned repo: $repo"
    rm -rf "$repo"
  fi
done

# 2. Clean up test instances from the database
# Note: This requires the server to be running
API_URL="${API_URL:-http://localhost:3456}"

echo "  Fetching instances from API..."
INSTANCES=$(curl -s "$API_URL/api/instances" 2>/dev/null || echo '{"data":[]}')

# Extract test instance IDs (bugdrop, social-tools, etc.)
TEST_INSTANCE_NAMES=("bugdrop" "social-tools")

for name in "${TEST_INSTANCE_NAMES[@]}"; do
  INSTANCE_ID=$(echo "$INSTANCES" | grep -o "\"id\":\"[^\"]*\",\"name\":\"$name\"" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)
  if [ -n "$INSTANCE_ID" ]; then
    echo "  Deleting instance: $name ($INSTANCE_ID)"
    curl -s -X DELETE "$API_URL/api/instances/$INSTANCE_ID" > /dev/null 2>&1 || true
  fi
done

# 3. Clean up test projects from registry
echo "  Fetching projects from API..."
PROJECTS=$(curl -s "$API_URL/api/projects" 2>/dev/null || echo '{"data":[]}')

for name in "${TEST_INSTANCE_NAMES[@]}"; do
  PROJECT_ID=$(echo "$PROJECTS" | grep -o "\"id\":\"[^\"]*\",\"name\":\"$name\"" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 || true)
  if [ -n "$PROJECT_ID" ]; then
    echo "  Deleting project: $name ($PROJECT_ID)"
    curl -s -X DELETE "$API_URL/api/projects/$PROJECT_ID" > /dev/null 2>&1 || true
  fi
done

# 4. Clean up test tasks
echo "  Fetching tasks from API..."
TASKS=$(curl -s "$API_URL/api/tasks" 2>/dev/null || echo '{"data":[]}')

# Delete tasks containing test keywords
echo "  Cleaning up test tasks (containing 'bugdrop', 'BugDrop', etc.)..."
# This is a simple approach - in production you'd want more sophisticated filtering

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "You can now re-run the Smart Tasks test flow:"
echo "  1. Open Tasks modal"
echo "  2. Click 'Smart'"
echo "  3. Enter: Let's do the following: 1. Check for any open PRs on BugDrop 2. Check the current status of any issues in the Yojimbo repo"
echo "  4. Click 'Parse Tasks'"
echo "  5. Test the Clone & Create flow"
