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
| Projects (PPM) | Project spine — priority, budget, Drain gate, producer/PM links, Gantt timeline |
| Change Requests | Formal change request tracking per project — PENDING / APPROVED / REJECTED |
| Assets | Deliverables tracked through SOP stages with CD sign-off gate and review link |
| Production Engine | Lane routing — asset assignment, status, throughput view |
| Capacity | Weekly board — person × project × week allocation (100% cap enforced) |
| Financial | Man-day costing, AR position, overdue invoices, pipeline by stage, project health |
| People / ELC | Staff records — role, skills (rated 1–5 with full history), sign-off authority flag |
| Staffing | Staffing recommendation engine — matches skill requirements to available people |
| Users | Login accounts — email, role, optional link to a Person record (admin only) |

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
| PRODUCER | Dashboard, My Work, Projects, Change Requests, Capacity, Assets, Production, People, Staffing |
| PM | Same as PRODUCER; scoped to own projects on My Work |
| TEAM_LEAD | Dashboard, My Work, Projects (read), Assets, Production, Capacity, People |
| FINANCE | Financial tab, Projects (read), salary data |
| SALES | Sales pipeline + Clients only |

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
    prisma/seed.js              demo projects + people
    prisma/seed-users.js        default login accounts
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
npm install
npx prisma generate
npx prisma migrate deploy
node prisma/seed-users.js   # safe — skips existing accounts
npm run build
pm2 restart pop-os
```

Always run `npm run build` after any backend TypeScript changes — the server runs `dist/main.js`, not the source.

---

## Debugging in VS Code

1. Open a `.ts` file and click the gutter left of a line number to set a breakpoint.
2. Press **F5** and pick **Node.js** if prompted.
3. Trigger the action in the browser — execution pauses and you can inspect every variable.
