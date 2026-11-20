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
| Database | PostgreSQL | 16 | In a Docker container named `pop-os-db` (port 5432) |
| Frontend | Vanilla JS + Tailwind CSS | — | No build step; served as static files |
| Process manager | PM2 | Latest | Keeps the app alive after reboot |

> **Important — how 192.168.1.40 actually runs today:** PostgreSQL runs in a
> Docker container called `pop-os-db`; only the database is in Docker — the app
> itself runs on the host under PM2. There is no `psql` / `pg_dump` on the host,
> so run them inside the container (`docker exec pop-os-db ...`, see Backup below).
> Step 1 (native PostgreSQL) is kept as an alternative for a fresh server that
> doesn't use Docker — skip it if the `pop-os-db` container is already running.

---

## What Runs Where

```
Debian Server (192.168.1.40)
├── Docker
│   └── pop-os-db  (PostgreSQL 16, port 5432)  ← data in a Docker volume
├── /opt/pop-os/uploads                       ← job attachments (files on disk, NOT in the DB)
└── Node.js (host)
    └── NestJS app (compiled dist/main.js)  ← managed by PM2, port 3000
```

The NestJS app serves both the API (`/api/*`) and the frontend (`public/` folder) on **port 3000**.

---

## Step 1 — Install PostgreSQL 16 (native — alternative to the Docker container)

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

# Mattermost notifications (optional — leave blank to disable)
MATTERMOST_URL=https://mattermost.example.com
MATTERMOST_BOT_TOKEN=...
MATTERMOST_TEAM=your-team-slug   # the TEAM's URL slug: https://<host>/<team-slug>/channels/<channel>
```

> Mattermost needs a bot account created first (bot must be in the team and in
> each channel it posts to). Steps: **README.md → "Mattermost notifications"**.
> After the server is running, log in as ADMIN → Admin → Mattermost
> Notifications to create the rules. The server must be able to reach
> `MATTERMOST_URL` over the network (test: `curl <MATTERMOST_URL>/api/v4/system/ping`
> from the server).

> Keep this file private. It is in `.gitignore` and must never be committed.

---

## Step 6 — Install Dependencies & Build

```bash
cd /opt/pop-os
npm ci                      # installs exactly what package-lock.json says

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

# Install packages exactly as locked (removes any that were dropped, e.g. after a
# dependency was uninstalled). Use `npm ci`, NOT `npm install`, on the server.
npm ci

# Regenerate Prisma client (picks up schema changes)
npx prisma generate

# Apply any new migrations
npx prisma migrate deploy

# Rebuild and restart
npm run build
pm2 restart pop-os
```

> Always run `npm run build` after any backend TypeScript changes. If you skip it, the server runs the old compiled code and new routes/modules will not be registered.

> **Why `npm ci` and not `npm install`?** `npm ci` installs exactly what `package-lock.json` says
> and never rewrites it. `npm install` on the server adjusts the lockfile (the server's npm differs
> from the dev machine's), which leaves it locally modified and makes the next `git pull` fail with
> "your local changes would be overwritten". To add or remove a package, do it on the dev machine
> (`npm install <pkg>` / `npm uninstall <pkg>`) and commit `package-lock.json` with the change.
> If a pull is ever blocked by a modified lockfile: `git checkout -- package-lock.json`, then pull again.

---

## Connecting from Windows (SSH)

Use PuTTY or the built-in `ssh` command:

```powershell
# PowerShell / Command Prompt
ssh yeo@192.168.1.40
```

For scripted/automated commands (e.g. from Claude Code), use **SSH key
authentication** — never put the password on the command line or in a file.
Once your public key is in `~/.ssh/authorized_keys` on the server (and loaded
in the Windows `ssh-agent`), commands run without a prompt:

```powershell
ssh yeo@192.168.1.40 "command here"
```

Multi-line scripts are easiest to send base64-encoded from PowerShell (avoids
quoting and Windows line-ending problems):

```powershell
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($script -replace "`r","")))
ssh yeo@192.168.1.40 "echo $b64 | base64 -d | bash"
```

---

## Backup — PostgreSQL Data

The database runs in the `pop-os-db` container, so `pg_dump` runs inside it.
Back up before any migration that drops data:

```bash
mkdir -p ~/backups
docker exec pop-os-db pg_dump -U postgres pop_os > ~/backups/pop_os-$(date +%F).sql
```

**Job attachments are files on disk, not in the database** — `pg_dump` does not
include them. Back up the uploads folder too (default `/opt/pop-os/uploads`, or
`UPLOAD_DIR` if set):

```bash
tar czf ~/backups/uploads-$(date +%F).tgz -C /opt/pop-os uploads
```

To restore: stop the app (`pm2 stop pop-os`), drop and recreate an **empty**
`pop_os` database, then load the file:

```bash
docker exec -i pop-os-db psql -U postgres pop_os < ~/backups/pop_os-2026-11-20.sql
tar xzf ~/backups/uploads-2026-11-20.tgz -C /opt/pop-os
pm2 start pop-os
```

(Native-PostgreSQL install instead of Docker? Use `pg_dump -U pop_user -h localhost pop_os`
with the password in `~/.pgpass`, not on the command line.)

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
| Database not connecting | `docker ps` — is `pop-os-db` running? (native install: `sudo systemctl status postgresql`) |
| `ECONNREFUSED localhost:5432` | Database not running — `docker start pop-os-db` (native: `sudo systemctl start postgresql`) |
| Port 3000 not reachable | `sudo ufw status` — is the port open? |
| Migrations failing | Check `DATABASE_URL` in `.env` matches the database credentials |
| Old code running after update | You forgot `npm run build` — rebuild and `pm2 restart pop-os` |
| Prisma type errors after schema change | Run `npx prisma generate` to regenerate the client |
