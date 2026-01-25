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

# The API returns { success: true/false, data: { message, tunnelActive, ... } }
SUCCESS=$(echo "$INSTALL_RESPONSE" | jq -r '.success // false')
MESSAGE=$(echo "$INSTALL_RESPONSE" | jq -r '.data.message // .message // "No message"')
ERROR=$(echo "$INSTALL_RESPONSE" | jq -r '.error // .data.error // empty')
TUNNEL_ACTIVE=$(echo "$INSTALL_RESPONSE" | jq -r '.data.tunnelActive // false')
TUNNEL_PORT=$(echo "$INSTALL_RESPONSE" | jq -r '.data.tunnelPort // "N/A"')
TUNNEL_WARNING=$(echo "$INSTALL_RESPONSE" | jq -r '.data.warning // empty')

if [ "$SUCCESS" == "true" ]; then
    echo -e "${GREEN}✓ API returned success${NC}"
    echo -e "${GREEN}  Message: ${MESSAGE}${NC}"
    if [ "$TUNNEL_ACTIVE" == "true" ]; then
        echo -e "${GREEN}  Tunnel: Active on port ${TUNNEL_PORT}${NC}"
    else
        echo -e "${YELLOW}  Tunnel: Not active${NC}"
        if [ -n "$TUNNEL_WARNING" ]; then
            echo -e "${YELLOW}  Warning: ${TUNNEL_WARNING}${NC}"
        fi
    fi
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

# Step 5: Test tunnel connectivity
echo ""
echo -e "${YELLOW}Step 5: Testing tunnel connectivity...${NC}"
TUNNEL_TEST_RESPONSE=$(curl -s -X POST "http://${STAGING_HOST}:${STAGING_PORT}/api/machines/${MACHINE_ID}/test-tunnel")

echo "Tunnel Test Response:"
echo "$TUNNEL_TEST_RESPONSE" | jq .

TUNNEL_WORKING=$(echo "$TUNNEL_TEST_RESPONSE" | jq -r '.data.tunnelWorking // false')
TUNNEL_ERROR=$(echo "$TUNNEL_TEST_RESPONSE" | jq -r '.data.error // empty')

if [ "$TUNNEL_WORKING" == "true" ]; then
    echo -e "${GREEN}✓ Reverse tunnel is working - hooks can reach the server${NC}"
    HEALTH_STATUS=$(echo "$TUNNEL_TEST_RESPONSE" | jq -r '.data.healthResponse.status // "unknown"')
    echo -e "${GREEN}  Server health: ${HEALTH_STATUS}${NC}"
else
    echo -e "${RED}✗ Reverse tunnel is NOT working${NC}"
    if [ -n "$TUNNEL_ERROR" ]; then
        echo -e "${RED}  Error: ${TUNNEL_ERROR}${NC}"
    fi
    echo -e "${YELLOW}  Hooks will not function until tunnel is established${NC}"
    echo ""
    echo -e "${YELLOW}=== TEST PARTIALLY PASSED (hooks installed but tunnel not working) ===${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}=== TEST PASSED ===${NC}"
exit 0
