#!/bin/bash
# Deploy Yojimbo to Production Server (Mac Mini 2)
# This script deploys the code currently running on staging to production
# Usage: ./scripts/deploy-to-production.sh

set -e

# Configuration
STAGING_HOST="192.168.1.19"
STAGING_USER="neonwatty"
STAGING_SSH_KEY="$HOME/.ssh/id_ed25519"

PRODUCTION_HOST="192.168.1.18"
PRODUCTION_USER="jeremywatt"
PRODUCTION_DIR="/Users/jeremywatt/yojimbo"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Deploying to Production Server ===${NC}"

# First check staging is healthy
echo -e "${YELLOW}Checking staging health...${NC}"
STAGING_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://$STAGING_HOST:3456/api/health)
if [ "$STAGING_HEALTH" != "200" ]; then
    echo -e "${RED}Staging is not healthy (HTTP $STAGING_HEALTH). Please fix staging first.${NC}"
    exit 1
fi
echo -e "${GREEN}Staging is healthy${NC}"

# Get the branch currently running on staging
echo -e "${YELLOW}Getting staging branch...${NC}"
STAGING_BRANCH=$(ssh -i $STAGING_SSH_KEY $STAGING_USER@$STAGING_HOST "cd /Users/neonwatty/yojimbo && git rev-parse --abbrev-ref HEAD")
echo -e "Staging branch: ${YELLOW}$STAGING_BRANCH${NC}"

# Confirm deployment
read -p "Deploy $STAGING_BRANCH to production? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled${NC}"
    exit 0
fi

# SSH command helper for production
SSH_PROD="ssh $PRODUCTION_USER@$PRODUCTION_HOST"

# Check if yojimbo exists on production
PROD_EXISTS=$($SSH_PROD "[ -d $PRODUCTION_DIR ] && echo 'yes' || echo 'no'")

if [ "$PROD_EXISTS" == "no" ]; then
    echo -e "${YELLOW}Cloning repository on production...${NC}"
    $SSH_PROD "git clone https://github.com/neonwatty/yojimbo.git $PRODUCTION_DIR"
fi

# Update code on production
echo -e "${YELLOW}Updating code on production server...${NC}"
$SSH_PROD "source ~/.nvm/nvm.sh && nvm use 20 && cd $PRODUCTION_DIR && \
    git fetch origin && \
    git checkout $STAGING_BRANCH && \
    git pull origin $STAGING_BRANCH"

# Install dependencies and build
echo -e "${YELLOW}Installing dependencies and building...${NC}"
$SSH_PROD "source ~/.nvm/nvm.sh && nvm use 20 && cd $PRODUCTION_DIR && \
    npm ci && \
    npm run build"

# Restart the app
echo -e "${YELLOW}Restarting application...${NC}"
$SSH_PROD "source ~/.nvm/nvm.sh && nvm use 20 && pm2 restart yojimbo-production 2>/dev/null || \
    pm2 start $PRODUCTION_DIR/ecosystem.config.cjs && pm2 save"

# Wait for the app to start
echo -e "${YELLOW}Waiting for app to start...${NC}"
sleep 5

# Health check
echo -e "${YELLOW}Running health check...${NC}"
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://$PRODUCTION_HOST:3456/api/health)

if [ "$HEALTH_STATUS" == "200" ]; then
    echo -e "${GREEN}=== Production Deployment Successful! ===${NC}"
    echo -e "Production URL: http://$PRODUCTION_HOST:3456"
else
    echo -e "${RED}=== Health check failed (HTTP $HEALTH_STATUS) ===${NC}"
    echo -e "${RED}Check production logs: ssh $PRODUCTION_USER@$PRODUCTION_HOST 'source ~/.nvm/nvm.sh && pm2 logs'${NC}"
    exit 1
fi
