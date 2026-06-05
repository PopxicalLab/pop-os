# Pop OS — Server Setup & Deployment Guide

**Target OS:** Debian (on-premise)  
**Application:** Pop Group DX Operating System  
**Architecture:** NestJS API + PostgreSQL database, served on a single machine

---

## Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 18+ | LTS recommended |
| Framework | NestJS | 10 | REST API + static file serving |
| Language | TypeScript | 5.6 | Compiled to JS before running |
| ORM | Prisma | 5.20 | Schema + migrations + query client |
| Database | PostgreSQL | 16 | Runs in Docker |
| Container | Docker + Docker Compose | Latest | Database only |
| Frontend | Vanilla JS + Tailwind CSS | — | No build step; served as static files |
| Process manager | PM2 | Latest | Keeps the app alive after reboot |

---

## What Runs Where

```
Debian Server
├── Docker
│   └── PostgreSQL 16 container  ← data stored in a Docker volume
├── Node.js (host)
│   └── NestJS app (compiled)    ← managed by PM2
└── Nginx (optional)             ← reverse proxy on port 80/443
```

The NestJS app serves both the API (`/api/*`) and the frontend (`public/` folder) on **port 3000**.

---

## Step 1 — Install Docker

```bash
# Update package list
sudo apt update

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Allow your user to run Docker without sudo
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## Step 2 — Install Node.js 18+

```bash
# Install via NodeSource (Node 20 LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version
npm --version
```

---

## Step 3 — Install PM2

PM2 keeps the app running and restarts it automatically after a server reboot.

```bash
sudo npm install -g pm2
```

---

## Step 4 — Get the Code onto the Server

Option A — clone from GitHub (recommended):
```bash
cd /opt
sudo git clone https://github.com/popxicalLab/pop-os.git
sudo chown -R $USER:$USER /opt/pop-os
cd /opt/pop-os
```

Option B — copy from your local machine using `scp`:
```bash
# Run this from your Windows machine (PowerShell)
scp -r C:\Users\yys\dev\pop-os user@server-ip:/opt/pop-os
```

---

## Step 5 — Configure Environment

```bash
cd /opt/pop-os
cp .env.example .env
nano .env
```

Set these values in `.env`:

```env
DATABASE_URL="postgresql://pop_user:your_password@localhost:5432/pop_os"
```

> Keep this file private. Do not commit it to git.

---

## Step 6 — Start the Database

```bash
cd /opt/pop-os
docker compose up -d

# Confirm it's running
docker compose ps
```

---

## Step 7 — Install Dependencies & Build

```bash
cd /opt/pop-os
npm install

# Compile TypeScript to JavaScript
npm run build
```

The compiled output goes into the `dist/` folder.

---

## Step 8 — Run Database Migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

> Always use `migrate deploy` (not `migrate dev`) on a server. It applies existing migrations without prompting.

---

## Step 9 — Start the App with PM2

```bash
# Start the compiled app
pm2 start dist/main.js --name pop-os

# Save the process list so PM2 restarts it after a reboot
pm2 save

# Set PM2 to start on boot
pm2 startup
# ↑ This prints a command — copy and run it
```

Useful PM2 commands:
```bash
pm2 status          # see running processes
pm2 logs pop-os     # view live logs
pm2 restart pop-os  # restart after a code update
pm2 stop pop-os     # stop the app
```

---

## Step 10 — Verify

Open a browser and go to:
```
http://your-server-ip:3000
```

The Pop OS dashboard should load.

---

## Updating the Application

When you push new code from your development machine:

```bash
cd /opt/pop-os

# Pull latest code
git pull

# Install any new packages
npm install

# Apply any new migrations
npx prisma migrate deploy
npx prisma generate

# Rebuild and restart
npm run build
pm2 restart pop-os
```

---

## Optional — Nginx Reverse Proxy

If you want to access the app on port 80 (standard HTTP) instead of port 3000:

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/pop-os
```

Paste this config:

```nginx
server {
    listen 80;
    server_name your-server-ip;  # or your domain name

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pop-os /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Firewall

If `ufw` is active on the server:

```bash
sudo ufw allow 22      # SSH — keep this open or you'll lose access
sudo ufw allow 80      # HTTP (if using nginx)
sudo ufw allow 3000    # Direct app access (optional, skip if using nginx)
sudo ufw enable
```

---

## Backup — PostgreSQL Data

The database lives in a Docker volume. To back it up:

```bash
docker exec pop-os-db-1 pg_dump -U pop_user pop_os > backup_$(date +%Y%m%d).sql
```

To restore:
```bash
docker exec -i pop-os-db-1 psql -U pop_user pop_os < backup_20260605.sql
```

---

## Troubleshooting

| Problem | Check |
|---|---|
| App not starting | `pm2 logs pop-os` |
| Database not connecting | `docker compose ps` — is the container running? |
| Port 3000 not reachable | `sudo ufw status` — is the port open? |
| Migrations failing | Check `DATABASE_URL` in `.env` matches `docker-compose.yml` credentials |
