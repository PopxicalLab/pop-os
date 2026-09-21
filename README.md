# Pop OS — Pop Group Studio Operating System

The operating system for Pop Group (Lorrypop Studio + Popxical Lab). Replaces ad-hoc, reactive working with a structured system: prioritised projects, weekly capacity allocation, a standard production workflow, deliverable tracking, people/skills records, sales pipeline, and integrated accounting.

**Stack:** NestJS · TypeScript · Prisma ORM · PostgreSQL 16 · Tailwind CSS (CDN)

---

## Modules

| Module | What it does |
|---|---|
| My Work | Personal dashboard — capacity, assigned assets, sign-off queue, payment alerts per role |
| Dashboard | Cross-module command centre — active projects, capacity alerts, payment due alerts |
| Sales | Lead pipeline (Qualification → Proposal → Negotiation → Won/Lost), lead-to-project conversion |
| Clients | Account + contact management; linked leads and projects per client |
| Performance | Sales commission tracker — quarterly attainment, tier-based rates, per-person overrides |
| Projects (PPM) | Project spine — priority, budget, Drain gate, producer/PM links, Gantt timeline, project costs |
| Change Requests | Formal change request tracking per project — PENDING / APPROVED / REJECTED |
| Assets | Deliverables tracked through SOP stages with CD sign-off gate and review link |
| Production Engine | Lane routing — asset assignment, status, throughput view |
| Capacity | Weekly board — person × project × week allocation (100% cap enforced) |
| Financial | Man-day costing, AR position, overdue invoices, pipeline by stage, project health |
| People / ELC | Staff records — role, skills (rated 1–5 with full history), sign-off authority flag |
| Staffing | Staffing recommendation engine — matches skill requirements to available people |
| Users | Login accounts — email, role, optional link to a Person record (admin only) |
| Notifications | Admin-configured Mattermost messages — pick the message, recipients (channels / DMs) and a GMT+8 schedule |

---

## What you need installed

1. **Node.js v18+** — https://nodejs.org (use the LTS version)
2. **Docker Desktop** — https://www.docker.com/products/docker-desktop (runs PostgreSQL locally)
3. **VS Code** — https://code.visualstudio.com

Verify everything is ready:

    node --version
    npm --version
    docker --version

---

## First-time setup

```bash
# 1. Clone
git clone https://github.com/PopxicalLab/pop-os.git
cd pop-os

# 2. Create your .env
copy .env.example .env        # Windows
cp .env.example .env          # Mac / Linux

# 3. Edit .env — fill in at minimum:
#    DATABASE_URL, JWT_SECRET, SMTP_*, and the AUTOCOUNT_* vars
#    (optional) MATTERMOST_* — see "Mattermost notifications" below

# 4. Start the database
docker compose up -d

# 5. Install dependencies
npm install

# 6. Apply all migrations  ← use 'deploy' (not 'dev') on a fresh clone
npx prisma migrate deploy

# 7. Generate the Prisma client
npx prisma generate

# 8. Seed demo data
node prisma/seed.js

# 9. Seed default login accounts
node prisma/seed-users.js

# 10. Start the dev server
npm run start:dev
```

App runs at **http://localhost:3000** · Login page at **http://localhost:3000/login.html**

---

## Default login accounts

Change these passwords after first login. PM and TEAM_LEAD accounts must be created manually via the User Manager (admin → header icon).

| Email | Password | Role |
|---|---|---|
| admin@pop.studio | popOS@admin1 | ADMIN |
| producer@pop.studio | popOS@1234 | PRODUCER |
| sales@pop.studio | popOS@1234 | SALES |
| finance@pop.studio | popOS@1234 | FINANCE |

---

## Roles and access

| Role | Access |
|---|---|
| ADMIN | Everything — users, all tabs, Autocount push, salary data |
| PRODUCER | My Work, Dashboard, Projects, Change Requests, Capacity, Assets, Production, People, Staffing |
| PM | Same as PRODUCER; owns the Change Request process |
| TEAM_LEAD | My Work, Dashboard, Projects (read), Assets, Production, Capacity, Change Requests, People (read) |
| FINANCE | My Work, Financial tab, Projects (read), salary data |
| SALES | My Work, Sales pipeline + Clients only |
| STAFF | My Work, Dashboard, Projects (read), Assets, Production, Capacity, People (read) |

**Sign-off authority** is not tied to role — it is a per-person flag (`canSignOff`) set by an admin on the People tab. Only people with this flag enabled see the sign-off queue on My Work. Currently granted to: Calvin, Frankie, Tom.

**Salary visibility** is restricted to ADMIN and FINANCE. All other roles see `—` in the salary column and the salary field is hidden on the add-person form.

---

## Autocount integration

Pop OS pushes documents into Pop Group's Autocount Cloud accounting system. Autocount remains the source of truth for all financial data (double-entry, tax, bank reconciliation).

- WON lead → creates a Quotation in Autocount
- Project → creates a Sales Invoice in Autocount
- Documents are tracked locally as `AccountingDocument` records with due dates
- Finance Dashboard shows AR position, overdue alerts, and due-soon panel
- `PATCH /api/autocount/documents/:id/status` marks documents PAID or VOID

Credentials live in `.env` (see `.env.example` for all required vars).

---

## Email alerts

Payment due alerts are sent via SMTP (nodemailer). Configure in `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
SMTP_FROM="Pop OS <your@email.com>"
ALERT_EMAIL_TO=finance@pop.studio,admin@pop.studio
ALERT_DAYS=10
```

Trigger manually from the Financial tab ("✉ Send alert email"). Sends one digest email listing all active documents due within `ALERT_DAYS` days.

---

## Mattermost notifications

Pop OS can post to Mattermost channels and send private messages, using one
**bot account**. It is optional — leave the three `MATTERMOST_*` vars blank and
the feature stays off. Which messages go where is configured in the app
(**Admin → Mattermost Notifications**), not in `.env`.

Messages available: the **weekly capacity board** (scheduled), and **lead created** / **lead status changed** (sent the moment it happens).

### One-time setup (needs a Mattermost admin)

1. **Enable bot accounts:** System Console → Integrations → Bot Accounts →
   *Enable Bot Account Creation* = true → Save.
2. **Create the bot:** Integrations → Bot Accounts → *Add Bot Account*.
   Username `pop-os`, display name `Pop OS`, role **Member** (not System Admin).
3. **Copy the token** shown on the confirmation screen. It is shown once — if
   lost, generate a new one from the bot's entry in the list.
4. **Add the bot to the team:** open the team → team name → *Invite People* and
   add `pop-os`. (A bot cannot join a channel until it is in the team. If the
   search finds nothing: System Console → User Management → Teams → your team →
   *Add Members*, or on the server `mmctl team users add <team-slug> pop-os`.)
5. **Add the bot to each channel** it should post in (channel name → *Add
   Members*). Private channels need this too. Direct messages need no invite.

### Configure Pop OS

Add to `.env` (local) and to the server's `.env`:

```env
MATTERMOST_URL=https://mattermost.example.com   # site root only, no /api/... path
MATTERMOST_BOT_TOKEN=<token from step 3>        # a secret — never commit or paste in chat
MATTERMOST_TEAM=your-team-slug                  # the TEAM's URL slug — see below
```

**Finding the team slug.** `MATTERMOST_TEAM` is the big **team** the bot was
added to (not a channel), and it is the team's *URL name*, which can differ from
its display name ("Pop Group" might be `pop-group`). Open any channel in that
team and read the address bar:

```
https://mattermost.example.com/pop-group/channels/capacity
                               └────────┘          └──────┘
                               team slug           channel name
                               (.env)              (used in Admin rules)
```

Check it with the bot token — this returns the team's details if the slug is right:

```powershell
curl.exe -H "Authorization: Bearer <token>" https://mattermost.example.com/api/v4/teams/name/pop-group
```

One Pop OS install posts to a single team: every channel in your rules must
belong to `MATTERMOST_TEAM`. (Direct messages are not tied to a team.)

Restart the server (`npm run start:dev` locally, `pm2 restart pop-os` on the
server). The Admin page shows **● Mattermost connected** when the vars are set.

Quick check that the token works (PowerShell):

```powershell
curl.exe https://mattermost.example.com/api/v4/system/ping
curl.exe -H "Authorization: Bearer <token>" https://mattermost.example.com/api/v4/users/me
```

The second should return JSON containing `"username":"pop-os"` and `"is_bot":true`.

### Create a rule

Admin → Mattermost Notifications → **+ New rule**: choose the message, an
optional company filter, day and time (**GMT+8**), and recipients. For the
weekly capacity board you also choose what it contains:

| Setting | Options |
|---|---|
| Sections | **Per person** (total % with project split, over / free flags), **Per project** (who is on it, total % / FTE), **Available people** (under 90% booked, most free first) |
| Week shown | This week or next week (e.g. a Friday "next week" preview and a Monday recap as two rules) |
| People from | Company (by the *person's* company; Group / untagged people always included) and/or specific departments |
| Include people with nothing booked | Lists active people with 0% so gaps are visible |

**Lead created / lead status changed** have no schedule — they post as soon as
a lead is added or moves stage in the Sales pipeline:

| Setting | Options |
|---|---|
| Stages (status changed only) | Only tell me when a lead moves *to* these stages, e.g. just Won and Lost. None ticked = every stage. |
| Leads from | Company filter (Group / untagged leads always match) |
| Show the estimated value | Untick if the channel is wider than who should see deal sizes |
| @mention the closer | Pings whoever closed the deal, if their Mattermost account is found by their Pop OS login email; otherwise their name is shown without a ping |

**Send test** on these rules posts a sample message (clearly marked as sample
data) so you can see the layout; **Run now** doesn't apply because the rule
fires by itself. These replace the old WhatsApp lead messages, which have been
retired — Pop OS no longer needs WhatsApp, Puppeteer or Chromium.

Recipients:

- **Channel** — the name in the channel's URL (`…/channels/`**`capacity`**), not
  its display name.
- **Person (DM)** — a Pop OS user. Their Mattermost account is matched by login
  email; if Mattermost hides emails from the bot, type their `@username` instead.

Use **Send test** to check delivery and **Run now** to post the real message
immediately. The scheduler checks every minute and survives restarts (a slot
missed by up to an hour is still sent, once). It assumes a single server
process.

---

## Windows — critical migration rule

**Stop the dev server before running any migration on Windows.**
A running server holds a lock on the Prisma engine DLL and the migration will fail.

```
1. Ctrl+C  (stop dev server)
2. npx prisma migrate dev --name <name>
3. npx prisma generate
4. npm run start:dev
```

This does not apply on macOS or Linux.

---

## Database commands

    docker compose up -d        start the database
    docker compose down         stop (data kept)
    docker compose down -v      wipe everything and start fresh
    npx prisma studio           browse your data in a GUI

---

## Project structure

    prisma/schema.prisma        database shape — edit here, then migrate
    prisma/seed.js                    demo projects + people
    prisma/seed-users.js              default login accounts
    prisma/seed-sales-performance.js  Q1+Q2 2026 demo data (leads, targets, costs)
    docker-compose.yml          runs PostgreSQL in Docker (dev only)
    .env                        secrets (never commit this)
    src/main.ts                 server entry point
    src/app.module.ts           root module — import new modules here
    src/prisma.service.ts       shared database connection

    src/<module>/               one folder per domain:
        <module>.dto.ts         incoming data shapes + validation
        <module>.service.ts     business logic, talks to DB via PrismaService
        <module>.controller.ts  HTTP endpoints
        <module>.module.ts      wires controller + service together

    public/index.html           app shell — nav, auth check, tab switching
    public/login.html           animated login page
    public/guide.html           director's guide — roles, access, how-tos
    public/js/<module>.js       tab UI logic (one file per module)

---

## Server deployment (192.168.1.40)

The server runs Debian. PostgreSQL runs natively (no Docker). PM2 manages the Node process.

```bash
cd /opt/pop-os
git pull
npm ci                      # exact lockfile install — not `npm install` (see below)
npx prisma generate
npx prisma migrate deploy
node prisma/seed-users.js   # safe — skips existing accounts
npm run build
pm2 restart pop-os
```

Always run `npm run build` after any backend TypeScript changes — the server runs `dist/main.js`, not the source.

Use **`npm ci`** on the server (it installs exactly what `package-lock.json` says and never
rewrites it). `npm install` there modifies the lockfile and can block the next `git pull`.
Only run `npm install <package>` / `npm uninstall <package>` on your dev machine, and commit
the updated `package-lock.json` with the change. If a pull is ever blocked by a modified
lockfile on the server: `git checkout -- package-lock.json`, then pull again.

---

## Debugging in VS Code

1. Open a `.ts` file and click the gutter left of a line number to set a breakpoint.
2. Press **F5** and pick **Node.js** if prompted.
3. Trigger the action in the browser — execution pauses and you can inspect every variable.
