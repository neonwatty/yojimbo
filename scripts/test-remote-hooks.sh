#!/bin/bash
# Test remote hooks installation via the staging API
# Usage: ./scripts/test-remote-hooks.sh [staging_host] [machine_name]
#
# This script calls the staging server's API to install hooks on a remote machine
# and verifies the API returns success.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
STAGING_HOST="${1:-Jeremys-Mac-mini.local}"
STAGING_PORT="3456"
MACHINE_NAME="${2:-macbook}"

echo -e "${YELLOW}=== Remote Hooks Integration Test ===${NC}"
echo "Staging: http://${STAGING_HOST}:${STAGING_PORT}"
echo "Machine: ${MACHINE_NAME}"
echo ""

# Step 1: Get the machine ID from the staging server
echo -e "${YELLOW}Step 1: Finding remote machine in database...${NC}"
MACHINES_RESPONSE=$(curl -s "http://${STAGING_HOST}:${STAGING_PORT}/api/machines")
MACHINE_ID=$(echo "$MACHINES_RESPONSE" | jq -r ".data[] | select(.hostname == \"${MACHINE_NAME}\" or .name == \"${MACHINE_NAME}\") | .id" | head -1)

if [ -z "$MACHINE_ID" ] || [ "$MACHINE_ID" == "null" ]; then
    echo -e "${RED}ERROR: Could not find machine '${MACHINE_NAME}' in staging database${NC}"
    echo "Available machines:"
    echo "$MACHINES_RESPONSE" | jq -r '.data[] | "  - \(.name) (\(.hostname))"'
    exit 1
fi
echo -e "${GREEN}Found machine ID: ${MACHINE_ID}${NC}"

# Step 2: Call the hooks install API
echo -e "${YELLOW}Step 2: Installing hooks via API...${NC}"
INSTALL_RESPONSE=$(curl -s -X POST \
    "http://${STAGING_HOST}:${STAGING_PORT}/api/machines/${MACHINE_ID}/install-hooks" \
    -H "Content-Type: application/json" \
    -d "{\"orchestratorUrl\": \"http://${STAGING_HOST}:${STAGING_PORT}\"}")

echo "API Response:"
echo "$INSTALL_RESPONSE" | jq .

# Step 3: Check if install was successful
echo ""
echo -e "${YELLOW}Step 3: Verifying result...${NC}"

# The API returns { success: true/false, message: "...", error?: "..." }
SUCCESS=$(echo "$INSTALL_RESPONSE" | jq -r '.success // false')
MESSAGE=$(echo "$INSTALL_RESPONSE" | jq -r '.message // "No message"')
ERROR=$(echo "$INSTALL_RESPONSE" | jq -r '.error // empty')

if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ API returned success${NC}"
    echo -e "${GREEN}  Message: ${MESSAGE}${NC}"
else
    echo -e "${RED}✗ API returned failure${NC}"
    echo -e "${RED}  Message: ${MESSAGE}${NC}"
    if [ -n "$ERROR" ]; then
        echo -e "${RED}  Error: ${ERROR}${NC}"
    fi
    echo ""
    echo -e "${RED}=== TEST FAILED ===${NC}"
    exit 1
fi

# Step 4: Check hooks status to verify they exist
echo ""
echo -e "${YELLOW}Step 4: Checking hooks status...${NC}"
STATUS_RESPONSE=$(curl -s "http://${STAGING_HOST}:${STAGING_PORT}/api/machines/${MACHINE_ID}/hooks-status")

echo "Hooks Status:"
echo "$STATUS_RESPONSE" | jq .

# Handle both response formats: .data.hookTypes or .existingHooks
HOOKS_COUNT=$(echo "$STATUS_RESPONSE" | jq -r '(.data.hookTypes // .existingHooks // []) | length')

if [ "$HOOKS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Found ${HOOKS_COUNT} hook types installed${NC}"
    echo "$STATUS_RESPONSE" | jq -r '(.data.hookTypes // .existingHooks // [])[]' | while read hook; do
        echo -e "  ${GREEN}✓${NC} $hook"
    done
else
    echo -e "${YELLOW}⚠ No hooks found${NC}"
fi

echo ""
echo -e "${GREEN}=== TEST PASSED ===${NC}"
exit 0
