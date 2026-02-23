#!/usr/bin/env bash
set -euo pipefail

# MicroChat Production Deployment Script
# Deploys both Workers API (Cloudflare) and Frontend (VPS)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VPS_HOST="zurd"
VPS_PATH="/home/vasily/websites/micro-chat-service"

cd "$ROOT_DIR"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo -e "⚠️  Attention! Deployments must be run from the main branch. Current branch is: \033[94m$CURRENT_BRANCH\033[0m"
  exit 0
fi

echo "==> Checking git remote status..."
if ! git push --dry-run > /dev/null 2>&1; then
  echo -e "⚠️  Attention! Git push would fail, likely because your branch is behind the remote."
  echo -e "Please run \033[94mgit pull\033[0m to integrate remote changes before deploying."
  exit 0
fi

echo ""
echo "==> Running pre-deploy checks..."
pnpm typecheck
pnpm build

echo ""
echo "==> Pushing to git..."
if ! git push; then
  echo -e "⚠️  Attention! Git push failed. Please resolve the issue and try again."
  exit 0
fi

echo ""
echo "==> Deploying Workers API to Cloudflare..."
cd "$ROOT_DIR/packages/server"
pnpm wrangler deploy --env production

echo ""
echo "==> Deploying Frontend to VPS..."
ssh "$VPS_HOST" "bash -l -c 'cd $VPS_PATH && git fetch origin && git reset --hard origin/main && pnpm install --frozen-lockfile && pnpm build && pm2 reload ecosystem.config.js --update-env 2>/dev/null || pm2 start apps/web/ecosystem.config.js && pm2 save'"

echo ""
echo "==> Deployment complete!"
