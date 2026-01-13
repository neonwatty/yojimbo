#!/bin/bash
# Deploy Yojimbo to Staging Server (Mac Mini 1)
# Usage: ./scripts/deploy-to-staging.sh [branch]
# If no branch specified, uses current branch

set -e

# Configuration
STAGING_HOST="Jeremys-Mac-mini.local"
STAGING_USER="neonwatty"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/Users/neonwatty/yojimbo"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Deploying to Staging Server ===${NC}"

# Get branch to deploy
BRANCH=${1:-$(git rev-parse --abbrev-ref HEAD)}
echo -e "${YELLOW}Branch: ${BRANCH}${NC}"

# Ensure we have the latest changes pushed
echo -e "${YELLOW}Pushing changes to origin...${NC}"
git push origin "$BRANCH" 2>/dev/null || true

# SSH command helper
SSH_CMD="ssh -i $SSH_KEY $STAGING_USER@$STAGING_HOST"

# Update code on staging
echo -e "${YELLOW}Updating code on staging server...${NC}"
$SSH_CMD "source ~/.nvm/nvm.sh && nvm use 20 && cd $REMOTE_DIR && \
    git fetch origin && \
    git checkout $BRANCH && \
    git reset --hard origin/$BRANCH"

# Install dependencies and build
echo -e "${YELLOW}Installing dependencies and building...${NC}"
$SSH_CMD "source ~/.nvm/nvm.sh && nvm use 20 && cd $REMOTE_DIR && \
    npm ci && \
    npm run build"

# Restart the app (delete and start to pick up env changes)
echo -e "${YELLOW}Restarting application...${NC}"
$SSH_CMD "source ~/.nvm/nvm.sh && nvm use 20 && cd $REMOTE_DIR && pm2 delete yojimbo-staging 2>/dev/null || true && pm2 start ecosystem.config.cjs && pm2 save"

# Wait for the app to start
echo -e "${YELLOW}Waiting for app to start...${NC}"
sleep 5

# Health check
echo -e "${YELLOW}Running health check...${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$STAGING_HOST:3456/api/health)

if [ "$HEALTH_STATUS" == "200" ]; then
    echo -e "${GREEN}=== Deployment Successful! ===${NC}"
    echo -e "Staging URL: http://$STAGING_HOST:3456"
else
    echo -e "${RED}=== Health check failed (HTTP $HEALTH_STATUS) ===${NC}"
    echo -e "${RED}Check staging logs: ssh $STAGING_USER@$STAGING_HOST 'source ~/.nvm/nvm.sh && pm2 logs'${NC}"
    exit 1
fi
