# Deploy on your own server (Ubuntu/Debian + Nginx + pm2)

This guide deploys the dashboard and bot under your domain with HTTPS using Nginx and pm2.

## 0) Prereqs
- A VPS or server (Ubuntu/Debian)
- A domain pointing to the server
- Node.js 18+ and npm

## 1) DNS
Create an A record:
- Name: `theforgebot.co.uk`
- Type: A → Your server IPv4

## 2) Clone and configure
```bash
# SSH into your server
sudo apt update && sudo apt install -y git

cd /opt
sudo git clone <your-repo-url> vtuber-bot
cd vtuber-bot

# Create .env (fill your secrets)
cp .env.example .env  # or upload your .env
```

Set production values in `.env`:
```
HOST=127.0.0.1
PORT=3001
PUBLIC_BASE_URL=https://theforgebot.co.uk
DEV_MODE=0
TRUST_PROXY=loopback,uniquelocal
OAUTH_REDIRECT_URI=https://theforgebot.co.uk/oauth/callback
```

## 3) Install dependencies + pm2
```bash
npm ci
sudo npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # follow the printed command
pm2 status
```

Logs:
```bash
pm2 logs vtuber-bot --lines 200
```

## 4) Install Nginx and configure
```bash
sudo apt install -y nginx
```

Copy the server block:
```bash
sudo mkdir -p /etc/nginx/includes
sudo cp server-blocks/include/proxy.conf /etc/nginx/includes/proxy.conf
sudo cp server-blocks/theforgebot.co.uk.conf /etc/nginx/sites-available/vtuber-bot
sudo ln -s /etc/nginx/sites-available/vtuber-bot /etc/nginx/sites-enabled/vtuber-bot
sudo nginx -t && sudo systemctl reload nginx
```

## 5) HTTPS (Let’s Encrypt)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d theforgebot.co.uk
```

Certbot will edit the config to terminate TLS then proxy to your app.

## 6) Discord settings
- OAuth redirect: `https://theforgebot.co.uk/oauth/callback`
- Update `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET` in `.env`

## 7) Updates
```bash
cd /opt/vtuber-bot
git pull
npm ci
pm2 restart vtuber-bot
```

## Troubleshooting
- Port in use: adjust `PORT` or stop the conflicting service.
- Wrong base URL: check `PUBLIC_BASE_URL` and `TRUST_PROXY`.
- 401 after login: ensure Discord OAuth redirect matches exactly.
- Blank page: check `pm2 logs vtuber-bot` and `sudo journalctl -u nginx -n 200 -f`.
