# Pop OS — Server Setup & Deployment Guide

**Target OS:** Debian (on-premise)  
**Server IP:** 192.168.1.40  
**SSH user:** yeo  
**App path:** /opt/pop-os  
**Application:** Pop Group DX Operating System  
**Architecture:** NestJS API + PostgreSQL database, served on a single machine

---

## Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 18+ | LTS recommended |
| Framework | NestJS | 10 | REST API + static file serving |
| Language | TypeScript | 5.6 | Compiled to JS before running — `npm run build` required |
| ORM | Prisma | 5 | Schema + migrations + query client |
| Database | PostgreSQL | 16 | Runs natively on the server (NOT Docker) |
| Frontend | Vanilla JS + Tailwind CSS | — | No build step; served as static files |
| Process manager | PM2 | Latest | Keeps the app alive after reboot |

> **Important:** Docker is used for local development only (developer's machine). The production server runs PostgreSQL natively via the system package manager.

---

## What Runs Where

```
Debian Server (192.168.1.40)
├── PostgreSQL 16 (native, system service)  ← data stored on disk
└── Node.js (host)
    └── NestJS app (compiled dist/main.js)  ← managed by PM2, port 3000
```

The NestJS app serves both the API (`/api/*`) and the frontend (`public/` folder) on **port 3000**.

---

## Step 1 — Install PostgreSQL 16 (native)

```bash
# Add PostgreSQL APT repository
sudo apt install -y curl ca-certificates gnupg
curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /usr/share/keyrings/postgresql.gpg

echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
sudo apt install -y postgresql-16

# Verify
psql --version
```

### Create the database and user

```bash
sudo -u postgres psql

# Inside psql:
CREATE USER pop_user WITH PASSWORD 'your_strong_password';
CREATE DATABASE pop_os OWNER pop_user;
GRANT ALL PRIVILEGES ON DATABASE pop_os TO pop_user;
\q
```

### Allow local connections

Edit `/etc/postgresql/16/main/pg_hba.conf` — find the local connection lines and ensure `pop_user` can connect:

```
# IPv4 local connections:
host    all             pop_user        127.0.0.1/32            md5
```

```bash
sudo systemctl restart postgresql
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

```bash
cd /opt
sudo git clone https://github.com/PopxicalLab/pop-os.git
sudo chown -R $USER:$USER /opt/pop-os
cd /opt/pop-os
```

---

## Step 5 — Configure Environment

```bash
cd /opt/pop-os
cp .env.example .env
nano .env
```

Fill in all required values:

```env
DATABASE_URL="postgresql://pop_user:your_password@localhost:5432/pop_os"
JWT_SECRET="a-long-random-string"

# Autocount Cloud
AUTOCOUNT_BASE_URL=https://...
AUTOCOUNT_ACCOUNT_BOOK_ID=60777
AUTOCOUNT_KEY_ID=...
AUTOCOUNT_API_KEY=...
AUTOCOUNT_DEFAULT_LOCATION=HQ
AUTOCOUNT_DEFAULT_CREDIT_TERM=C.O.D.

# Email alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
SMTP_FROM="Pop OS <your@email.com>"
ALERT_EMAIL_TO=finance@pop.studio,admin@pop.studio
ALERT_DAYS=10
```

> Keep this file private. It is in `.gitignore` and must never be committed.

---

## Step 6 — Install Dependencies & Build

```bash
cd /opt/pop-os
npm install

# Generate Prisma client (must run after install)
npx prisma generate

# Apply all migrations
npx prisma migrate deploy

# Seed default login accounts (safe — skips existing users)
node prisma/seed-users.js

# Compile TypeScript to JavaScript
npm run build
```

The compiled output goes into the `dist/` folder. The server always runs `dist/main.js`.

---

## Step 7 — Start the App with PM2

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
pm2 logs pop-os     # view live logs (last 20 lines)
pm2 logs pop-os --lines 100   # more lines
pm2 restart pop-os  # restart after a code update
pm2 stop pop-os     # stop the app
```

---

## Step 8 — Verify

Open a browser and go to:

```
http://192.168.1.40:3000
```

The Pop OS login page should load. Log in with:

| Email | Password | Role |
|---|---|---|
| admin@pop.studio | popOS@admin1 | ADMIN |
| producer@pop.studio | popOS@1234 | PRODUCER |
| sales@pop.studio | popOS@1234 | SALES |
| finance@pop.studio | popOS@1234 | FINANCE |

---

## Routine Deployment (pushing new code)

Run this from the server each time you push changes from your development machine:

```bash
cd /opt/pop-os

# Pull latest code
git pull

# Install any new packages
npm install

# Regenerate Prisma client (picks up schema changes)
npx prisma generate

# Apply any new migrations
npx prisma migrate deploy

# Rebuild and restart
npm run build
pm2 restart pop-os
```

> Always run `npm run build` after any backend TypeScript changes. If you skip it, the server runs the old compiled code and new routes/modules will not be registered.

---

## Connecting from Windows (SSH)

Use PuTTY or the built-in `ssh` command:

```powershell
# PowerShell / Command Prompt
ssh yeo@192.168.1.40
```

For scripted/automated commands (e.g. from Claude Code):

```bash
"/c/Program Files/PuTTY/plink" -ssh -pw "password" \
  -hostkey "SHA256:ChVivbVTuIHZIW6fWYS6I6agIyOuWIo5H1ZUBXT0Hrk" \
  yeo@192.168.1.40 "command here"
```

---

## Backup — PostgreSQL Data

The database runs natively. Back it up with pg_dump:

```bash
# Create a backup
pg_dump -U pop_user -h localhost pop_os > backup_$(date +%Y%m%d).sql

# Or with password prompt suppressed (add to .pgpass or use PGPASSWORD)
PGPASSWORD=your_password pg_dump -U pop_user -h localhost pop_os > backup_$(date +%Y%m%d).sql
```

To restore:

```bash
PGPASSWORD=your_password psql -U pop_user -h localhost pop_os < backup_20260616.sql
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
    server_name 192.168.1.40;  # or your domain name

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
sudo ufw allow 3000    # Direct app access (if not using nginx)
sudo ufw enable
```

---

## Troubleshooting

| Problem | What to check |
|---|---|
| App not starting | `pm2 logs pop-os` |
| Database not connecting | `sudo systemctl status postgresql` — is it running? |
| `ECONNREFUSED localhost:5432` | PostgreSQL not running — `sudo systemctl start postgresql` |
| Port 3000 not reachable | `sudo ufw status` — is the port open? |
| Migrations failing | Check `DATABASE_URL` in `.env` matches the database credentials |
| Old code running after update | You forgot `npm run build` — rebuild and `pm2 restart pop-os` |
| Prisma type errors after schema change | Run `npx prisma generate` to regenerate the client |
