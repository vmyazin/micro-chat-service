#!/usr/bin/env bash
set -euo pipefail

# MicroChat Production Deployment Script
# Deploys both Workers API (Cloudflare) and Frontend (VPS)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
VPS_HOST="zurd"
VPS_PATH="/home/vasily/websites/micro-chat-service"

cd "$ROOT_DIR"

echo "==> Running pre-deploy checks..."
pnpm typecheck
pnpm build

echo ""
echo "==> Pushing to git..."
git push

echo ""
echo "==> Deploying Workers API to Cloudflare..."
cd "$ROOT_DIR/packages/server"
pnpm wrangler deploy --env production

echo ""
echo "==> Deploying Frontend to VPS..."
ssh -t "$VPS_HOST" "bash -l -c 'cd $VPS_PATH && git pull && pnpm install --frozen-lockfile && pnpm build && pm2 restart microchat-web'"

echo ""
echo "==> Deployment complete!"
