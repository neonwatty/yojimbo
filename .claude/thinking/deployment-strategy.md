# Idea: Yojimbo Deployment Strategy

> Separate dev and prod environments to eliminate confusion, with optional remote access via Tailscale.

## The Problem

Running both development and production versions of Yojimbo on the same machine causes:
- **URL/tab confusion**: Accidentally using the wrong environment
- **Data conflicts**: Dev changes affecting production data
- **Port conflicts**: Can't run both simultaneously

Secondary consideration: occasional need to access the app from outside the home network.

## The Solution

**Deploy production to a dedicated Mac mini on your home network.**

This provides:
- Physical separation (different machine = can't accidentally use wrong one)
- Data isolation (completely separate databases and config)
- Simultaneous operation (dev on laptop, prod on Mac mini)
- Remote access via Tailscale when traveling

## Why NOT Split Architecture (Vercel + Home Backend)

The split approach (public frontend, home backend) was considered but adds unnecessary complexity:
- Requires API authentication (currently none)
- Requires HTTPS/TLS setup
- Requires CORS configuration for cross-origin requests
- Requires making backend URL configurable in the client
- Solves remote access problem that's only "occasional"

**Tailscale gives you remote access with zero code changes.** The split architecture solves a bigger problem than you have.

## Riskiest Assumptions

1. **Mac mini stays online**: If it goes down, prod is unavailable
2. **Tailscale reliability**: Remote access depends on VPN working
3. **Manual deployments**: Without CI/CD, you might forget to deploy updates

## Possible Directions

### Direction 1: Mac Mini + Tailscale (Recommended)

**What it is:** Run prod on Mac mini, access via local IP or Tailscale.

**Pros:**
- Zero code changes required
- Complete environment isolation
- Simple mental model (different machines = different environments)
- Tailscale handles remote access seamlessly

**Cons:**
- Requires Mac mini to stay on
- Manual deployments (unless you add CI/CD)
- Can't share with others without giving them VPN access

**When to choose:** You want the immediate problem solved with minimal work.

### Direction 2: Mac Mini + Simple CI/CD

**What it is:** Same as Direction 1, but add GitHub Actions to auto-deploy on push to main.

**Pros:**
- All benefits of Direction 1
- Deployments happen automatically
- Less chance of forgetting to update prod

**Cons:**
- Requires setting up SSH access from GitHub Actions to Mac mini
- Slightly more initial setup

**When to choose:** You're actively developing and want updates to flow automatically.

### Direction 3: Future SaaS-Ready (Later)

**What it is:** Host static frontend on Vercel/Netlify, users run their own backends.

**Pros:**
- Public URL for the frontend (easy to share)
- Each user manages their own Claude instances
- Low hosting costs (static files only)

**Cons:**
- Requires adding backend URL configuration UI
- Requires API authentication for security
- More complex mental model for users

**When to choose:** You're ready to share this with friends or explore productization.

## MVP Scope (Direction 1)

The simplest version that solves your problem:

1. **Build production bundle** on your dev machine
2. **Copy to Mac mini** (rsync or git clone)
3. **Run with PM2 or systemd** for process management
4. **Access via local IP** (e.g., `http://mac-mini.local:3457`)
5. **Set up Tailscale** on Mac mini and your mobile devices

## Open Questions

- [ ] What's the Mac mini's local hostname or IP?
- [ ] Do you want PM2 (simpler) or launchd (more macOS-native)?
- [ ] Should dev and prod use different ports for extra clarity?
- [ ] Do you want visual differentiation (e.g., different header color for prod)?

## Next Steps

1. **Immediate**: Set up prod on Mac mini with PM2
2. **This week**: Install Tailscale on Mac mini and mobile devices
3. **This week**: Set up GitHub Actions auto-deployment via Tailscale
4. **Future**: If you want to share, add backend URL config to settings

## CI/CD Setup: GitHub Actions + Tailscale

### Prerequisites
1. Tailscale installed on Mac mini
2. Tailscale OAuth client for GitHub Actions
3. SSH key for GitHub Actions to access Mac mini

### Step 1: Create Tailscale OAuth Client

1. Go to https://login.tailscale.com/admin/settings/oauth
2. Create new OAuth client with:
   - Description: "GitHub Actions Deploy"
   - Scopes: `devices:read`, `auth:write` (for ephemeral nodes)
3. Create an ACL tag for CI (in Tailscale ACL policy):
   ```json
   "tagOwners": {
     "tag:ci": ["autogroup:admin"]
   }
   ```
4. Add secrets to GitHub repo:
   - `TS_OAUTH_CLIENT_ID`
   - `TS_OAUTH_SECRET`

### Step 2: Set Up SSH Access

On Mac mini:
```bash
# Create deploy user (optional, can use your user)
# Ensure SSH is enabled in System Preferences > Sharing > Remote Login
```

Add to GitHub secrets:
- `MAC_MINI_SSH_KEY`: Private key that can access Mac mini
- `MAC_MINI_USER`: Username on Mac mini
- `MAC_MINI_HOST`: Tailscale hostname (e.g., `mac-mini.tailnet-name.ts.net`)

### Step 3: Create GitHub Actions Workflow

Create `.github/workflows/deploy-prod.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:  # Allow manual trigger

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Tailscale
        uses: tailscale/github-action@v2
        with:
          oauth-client-id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
          oauth-secret: ${{ secrets.TS_OAUTH_SECRET }}
          tags: tag:ci

      - name: Setup SSH Key
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.MAC_MINI_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H ${{ secrets.MAC_MINI_HOST }} >> ~/.ssh/known_hosts 2>/dev/null || true

      - name: Deploy to Mac Mini
        run: |
          ssh -o StrictHostKeyChecking=no ${{ secrets.MAC_MINI_USER }}@${{ secrets.MAC_MINI_HOST }} << 'DEPLOY'
            set -e
            cd ~/yojimbo

            echo "📥 Pulling latest changes..."
            git fetch origin main
            git reset --hard origin/main

            echo "📦 Installing dependencies..."
            npm ci

            echo "🔨 Building..."
            npm run build

            echo "🔄 Restarting services..."
            pm2 restart yojimbo || pm2 start npm --name yojimbo -- start

            echo "✅ Deployment complete!"
          DEPLOY

      - name: Notify Success
        if: success()
        run: echo "🚀 Deployed to Mac mini successfully"

      - name: Notify Failure
        if: failure()
        run: echo "❌ Deployment failed"
```

### Step 4: Initial Mac Mini Setup

```bash
# On Mac mini
cd ~
git clone https://github.com/neonwatty/yojimbo.git
cd yojimbo
npm ci
npm run build

# Install PM2
npm install -g pm2

# Start the app
pm2 start npm --name yojimbo -- start

# Save PM2 config to survive reboots
pm2 save
pm2 startup  # Follow the instructions it prints
```

### Workflow

After setup, the flow is:
1. Push to `main` branch
2. GitHub Actions connects to Mac mini via Tailscale
3. Pulls latest code, rebuilds, restarts PM2
4. Prod is updated within ~2-3 minutes

## Decision Summary

| Consideration | Recommendation |
|---------------|----------------|
| Primary solution | Mac mini deployment |
| Remote access | Tailscale VPN |
| Deployment method | Start manual, add CI/CD later if needed |
| Split architecture | Not now; easy to add later if SaaS becomes real |
