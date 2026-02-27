# Deployment

## Architecture

- **Cloudflare Workers** -- API (`packages/server`): Hono + D1 + Durable Objects
- **VPS** -- Frontend (`apps/web`): Next.js behind nginx + Let's Encrypt

## 1. Deploy Workers API (from local machine)

```bash
cd packages/server

# First time: authenticate and create D1 database
pnpm wrangler login
pnpm wrangler d1 create microchat-db
# Update database_id in wrangler.toml with the returned ID

# Apply all pending migrations
pnpm wrangler d1 migrations apply microchat-db --remote --env production

# Deploy
pnpm wrangler deploy --env production
# Note the Workers URL (e.g. https://microchat-api-production.xxx.workers.dev)
```

## 2. Set up VPS

```bash
# Install runtime
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
corepack enable
corepack prepare pnpm@latest --activate
sudo npm install -g pm2

# Clone and build
cd /home/vasily/websites
git clone git@github.com:vmyazin/micro-chat-service.git
cd micro-chat-service
pnpm install --frozen-lockfile

# Set API URL for the Next.js rewrite proxy
echo 'API_URL=https://microchat-api-production.xxx.workers.dev' > apps/web/.env.production

# Build all packages (shared -> crypto -> client -> web)
pnpm build
```

## 3. Start Next.js with pm2

```bash
cd apps/web
PORT=3001 pm2 start pnpm --name "microchat-web" -- start
pm2 save
pm2 startup  # follow the printed command to enable boot persistence
```

## 4. Configure nginx

```bash
sudo tee /etc/nginx/sites-available/microchat > /dev/null <<'EOF'
server {
    listen 80;
    server_name microchat.smoxu.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/microchat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 5. SSL with Let's Encrypt

Ensure the DNS A record points to the VPS IP with Cloudflare proxy **disabled** (grey cloud).

```bash
sudo certbot --nginx -d microchat.smoxu.com
sudo certbot renew --dry-run  # verify auto-renewal
```

## Redeployment

### Workers API (from local machine)

```bash
cd packages/server
pnpm wrangler d1 migrations apply microchat-db --remote --env production
pnpm wrangler deploy --env production
```

### Frontend (on VPS)

```bash
cd /home/vasily/websites/micro-chat-service
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart microchat-web
```
