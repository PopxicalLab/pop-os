# Pop OS — Project Context for Claude Code

This is the operating system for **Pop Group**, a creative/3D production studio.
It replaces ad-hoc, reactive working with a structured system: prioritised
projects, weekly capacity allocation, a standard production workflow, and a
people/skills record. See the DX Action Plan for the full vision; this file
is the technical contract.

The owner is returning to coding after a long break and is most comfortable
in the Microsoft/Windows world. Favour clarity over cleverness. Explain
non-obvious choices in plain language. Keep comments in code that teach,
not just describe.

---

## Stack

- **Language:** TypeScript
- **Framework:** NestJS (v10)
- **ORM:** Prisma (v5)
- **Database:** PostgreSQL 16, run via Docker (docker-compose.yml)
- **UI Framework:** Tailwind CSS (CDN)
- **Frontend:** vanilla JS, no framework, served by NestJS via `ServeStaticModule`.
  `public/index.html` is a thin shell (HTML structure, shared utilities, theme,
  tab switching, auth check, global fetch wrapper). Each tab's logic lives in its
  own file under `public/js/`:
  `mywork.js`, `dashboard.js`, `sales.js`, `clients.js`, `sales-performance.js`,
  `projects.js`, `change-requests.js`, `assets.js`, `production.js`,
  `capacity.js`, `financial.js`, `people.js`, `staffing.js`.
  Adding a new tab = new file + one `<script src>` line in `index.html`.
  Keep it framework-free.
- **Auth:** JWT (`@nestjs/jwt`). Global `JwtAuthGuard` via `APP_GUARD`. Routes
  marked `@Public()` skip the guard. Token stored in `localStorage` as
  `pop-os-token`. `window.fetch` is overridden in `index.html` to inject the
  Bearer token on every request — no changes needed in individual tab JS files.
- **OS:** Windows (primary) and macOS (secondary). Windows path: `C:\Users\yys\dev\pop-os`.

This is a self-hosted project. No paid SaaS, no cloud services. Everything
must run locally and be free/open-source.

---

## Commands

These work identically on Windows (PowerShell) and macOS (Terminal).

- Start database:        `docker compose up -d`
- Stop database (keep):  `docker compose down`
- Reset database (wipe): `docker compose down -v` then `docker compose up -d`
- Install deps:          `npm install`
- Run a migration:       `npx prisma migrate dev --name <name>`
- Start dev server:      `npm run start:dev`  (auto-restarts on save)
- Inspect data (GUI):    `npx prisma studio`
- App + UI runs at:      http://localhost:3000
- Login page:            http://localhost:3000/login.html

### First-time setup on a new machine
1. Install Node.js (v18+) and Docker Desktop
2. `git clone https://github.com/popxicalLab/pop-os.git`
3. Copy env file: `cp .env.example .env` (Mac) or `copy .env.example .env` (Windows)
4. Fill in `.env` — at minimum `DATABASE_URL`, `JWT_SECRET`, and Autocount vars
5. `docker compose up -d`
6. `npm install`
7. `npx prisma migrate deploy`  ← use `deploy` (not `dev`) on a fresh clone
8. `node prisma/seed.js`        ← seed demo project/people data
9. `node prisma/seed-users.js`  ← seed default login accounts
10. `npm run start:dev`

### Claude Code skills (optional but recommended)
The `.agents/` folder and `skills-lock.json` are git-ignored — they don't clone with the repo.
To restore the caveman token-saving skill on a new machine:
```
/install JuliusBrussee/caveman
```
Then use `/caveman` to activate compressed responses, `stop caveman` to return to normal.

### Default login accounts (change passwords after first login)
| Email | Password | Role |
|---|---|---|
| admin@pop.studio | popOS@admin1 | ADMIN — full access |
| producer@pop.studio | popOS@1234 | PRODUCER |
| sales@pop.studio | popOS@1234 | SALES |
| finance@pop.studio | popOS@1234 | FINANCE |

---

## CRITICAL workflow rule (Windows file lock)

**Windows only.** When changing `prisma/schema.prisma`, ALWAYS do it in this order:
1. **Stop** the dev server (Ctrl+C) — releases the Prisma engine file lock.
2. Run `npx prisma migrate dev --name <name>`.
3. **Restart** `npm run start:dev`.

Running a migration while the dev server is live causes a Windows
`EPERM ... rename query_engine-windows.dll.node` error. Stopping the server
first avoids it. Do not skip this on Windows.

**macOS / Linux server:** This file lock does not exist. Migrations can be run
while the dev server is running — no need to stop it first.

---

## Module pattern (follow this for every new feature)

Each domain lives in its own folder under `src/` and is built from the same
five pieces, plus a Prisma model and a line in the root module. When adding a
module (e.g. Projects), create:

    src/<name>/
        <name>.dto.ts          # incoming-data shapes + class-validator rules
        <name>.service.ts      # logic; talks to the DB via PrismaService
        <name>.controller.ts   # HTTP endpoints (URLs)
        <name>.module.ts       # bundles controller + service + PrismaService

Then:
- add the model(s) to `prisma/schema.prisma`
- import the new module in `src/app.module.ts`
- run a migration (see workflow rule above)
- add a `public/js/<name>.js` file for the tab's UI logic
- add `<script src="/js/<name>.js"></script>` to `public/index.html`
- add a tab button to the nav and a panel div in `index.html`
- update `switchTab()` in `index.html` to include the new tab name

Conventions already in use (keep them consistent):
- IDs are `String @id @default(cuid())`.
- Every model has `createdAt` / `updatedAt`.
- Services throw `NotFoundException` / `ConflictException` for clean errors.
- DTOs validate everything; `main.ts` runs a global ValidationPipe with
  `whitelist: true, transform: true`.
- API routes are prefixed `/api`.
- All routes are JWT-guarded by default. Mark public routes with `@Public()`.

---

## Auth & roles

Seven roles, enforced on both backend (controller guards) and frontend (tab
visibility via `TAB_ACCESS` map in `index.html`):

| Role | Access |
|---|---|
| ADMIN | Everything — users, all tabs, Autocount push, salary data |
| PRODUCER | My Work, Dashboard, Projects, Change Requests, Capacity, Assets, Production, People, Staffing |
| PM | Same as PRODUCER; owns the Change Request process |
| TEAM_LEAD | My Work, Dashboard, Projects (read), Assets, Production, Capacity, Change Requests, People (read) |
| FINANCE | My Work, Financial tab, Projects (read), salary data |
| SALES | My Work, Sales pipeline, Clients only |
| STAFF | My Work, Dashboard, Projects (read), Assets, Production, Capacity, People (read) |

**User vs Person distinction:** `User` = login credential. `Person` = production
staff record (ELC). They are separate models. A `User` optionally links to a
`Person` via `personId` FK — set via the lock icon on People tab (admin only).
This link powers the My Work personal dashboard and sign-off queue.

**Lock icon on People tab:** Filled green = person has a login. Outline grey = no
login. Click (admin only) to create a login or view the linked account.

---

## Data model (current state)

- **Company** — enum: `LPS` / `PXL`. Optional on Person, Project, Account, Lead.
  Global filter in the header filters all tabs simultaneously.

- **Person** — staff record. Fields: name, role, department, startDate,
  employmentType, warmPool, company, salary (monthly RM, optional — ADMIN +
  FINANCE only), `canSignOff` (grants CD/3D sign-off authority — per-person
  flag, not tied to role), `commissionRateOverride` (optional flat rate that
  bypasses the global CommissionTier table). Has many PersonSkill, Capacity,
  PersonTierRate, and optionally one User.

- **Skill / PersonSkill / SkillRatingChange** — see Skills design decisions below.

- **ProjectSkill** — join table: which skills a project *requires* (no rating — just a tag).
  Producer tags skills on the project detail page. The staffing suggestion engine
  reads these to rank staff by skill rating + free capacity.

- **Project** — spine of the system. PPM fields, producer/PM links, Drain gate,
  accountId (optional link to Account). Has many ChangeRequest, ProjectSkill,
  ProjectCost, AccountingDocument.

- **ChangeRequest** — formal change request per project. Status: PENDING →
  APPROVED / REJECTED. Includes budget impact and approval note. PM owns the
  process; producers and team leads can view.

- **ProjectCost** — cost line item on a project. Type: `WARM_POOL` / `SUPPLIER`
  / `ADDITIONAL`. Added from project detail view. Summed to calculate net profit
  in the commission report.

- **Capacity** — weekly board. One row per person × project × week. 100% cap
  enforced in service. weekStart always Monday 00:00 UTC.

- **Asset** — deliverable through SOP stages. CD sign-off soft gate at
  INTERNAL_REVIEW.

- **Account** — client company. Has `autocountDebtorCode` (Autocount debtor
  account code — set once, reused for all quotes/invoices for that client).
  Has many Contact, Lead, Project.

- **Contact** — person at a client company. Linked to Account and Lead.

- **Lead** — sales opportunity. Status: QUALIFICATION → PROPOSAL → NEGOTIATION →
  WON → LOST. `convertToProject` endpoint creates a Project from a WON lead.
  Has many AccountingDocument (quotations pushed to Autocount).

- **AccountingDocument** — one Autocount document per row (QUOTATION,
  SALES_INVOICE, PURCHASE_INVOICE). Linked to Project and/or Lead. Fields:
  docNo (e.g. "QT_0626-004"), docDate, dueDate (calculated from credit term),
  amount, debtorCode, creditTerm, status (ACTIVE/PAID/VOID), notifiedAt.
  - `dueDate` drives the Dashboard payment alerts and Finance Dashboard overdue panel.
  - Multiple documents per project are normal (milestone billing, revised quotes).
  - When a lead converts to a project, existing AccountingDocuments are
    auto-linked to the new project.

- **SalesTarget** — quarterly revenue target per producer. Unique on
  `(personId, year, quarter)`. Drives attainment % in the commission report.

- **CommissionTier** — global rate schedule. Rows: threshold (e.g. `0.75` = 75%
  of target) + rate (e.g. `0.025` = 2.5%). Seeded with four tiers (50 / 75 /
  100 / 150%). Admin-editable from the Sales Performance settings panel.

- **PersonTierRate** — per-person override for a specific CommissionTier row.
  Takes precedence over the global tier rate for that person.

- **User** — login credential. Fields: email, name, password (bcrypt), role
  (7 values), active, personId (optional FK to Person). Seeded via
  `prisma/seed-users.js`.

### Skills design decisions (do not undo these without asking)

- Ratings are whole numbers 1–5. (Half-steps were deliberately deferred.)
- A skill score is a TRAJECTORY, not a snapshot. Every change writes a
  SkillRatingChange row. CURRENT rating lives on PersonSkill; history in
  SkillRatingChange. Always update both in a transaction.
- The interview score is the first history entry with source = INTERVIEW.
- RatingSource enum: INTERVIEW, PROJECT_COMPLETION, MANUAL_ADJUSTMENT.
- MANUAL_ADJUSTMENT requires a `note`. Enforced in DTO and UI.

---

## Autocount Cloud integration

Pop Group's accounting system. Pop OS is the **initiator** — it creates documents
in Autocount based on project context. Autocount remains the source of truth for
all financial data (double-entry, tax, bank reconciliation, etc.).

**Credentials** are in `.env`:
```
AUTOCOUNT_BASE_URL
AUTOCOUNT_ACCOUNT_BOOK_ID   # 60777
AUTOCOUNT_KEY_ID
AUTOCOUNT_API_KEY
AUTOCOUNT_DEFAULT_LOCATION  # HQ
AUTOCOUNT_DEFAULT_CREDIT_TERM  # C.O.D.
```

**Auth:** `Key-ID` and `API-Key` request headers (not `KeyId`/`ApiKey` —
the hyphens are required, as defined in the Swagger security scheme).

**Integration points:**
1. WON lead → `POST /api/autocount/leads/:id/quotation` → creates Quotation in
   Autocount, persists as AccountingDocument.
2. Project → `POST /api/autocount/projects/:id/invoice` → creates Sales Invoice,
   persists as AccountingDocument.
3. `GET /api/autocount/debtors` → lists Autocount debtors for the picker modal.
4. `PATCH /api/autocount/documents/:id/status` → mark PAID or VOID.
5. `GET /api/autocount/due-soon` → docs due within N days (also in dashboard).

**Document response pattern:** Autocount returns `201 Created` with no body.
The document number is in the `Location` response header as a query param:
`Location: https://…/quotation?docNo=QT_0626-004`
Extract with `new URL(header).searchParams.get('docNo')`.

---

## UI pattern: module summary strips

Every module tab opens with a compact stats bar above the main content.
The global Dashboard is the cross-module command centre. Each module's strip
is its own mini-dashboard in context.

**Navigation** uses grouped dropdowns:
- My Work (direct — personal dashboard for all roles)
- Dashboard (direct — cross-module command centre)
- Sales ▾ → Sales pipeline, Clients, Sales Performance (admin only)
- Production ▾ → Projects, Change Requests, Assets, Production engine, Capacity
- Financial (direct — FINANCE + ADMIN only)
- HR ▾ → People, Staffing

---

## Roadmap (build order, and why)

### Foundation (done)
1. **People / ELC** — DONE.
2. **Projects** — DONE.
3. **Capacity** — DONE.

### Intelligence layer (done)
4. **Dashboard** — DONE. Payment alerts section added (AccountingDocuments due
   within 10 days, with producer name to chase).
5. **PPM recommendation engine** — DONE.
6. **Staffing recommendation engine** — DONE.

### Production layer (done)
7. **Assets** — DONE.
8. **Production Engine / Lane Routing** — DONE.

### Financial layer (done)
9. **Financial Engine** — DONE. Man-day costing. `GET /api/financial/overview`,
   `GET /api/financial/projects`, `GET /api/financial/dashboard`.
   Finance Dashboard: AR KPI cards, overdue invoices, due-soon panel,
   pipeline by stage, project health RAG, recent Autocount documents.

### Auth & access control (done)
- **JWT auth** — DONE. Login page at `/login.html`. 7 roles. Global guard.
  `POST /api/auth/login`, `GET /api/auth/me`.
- **Users module** — DONE. `GET/POST/PATCH/DELETE /api/users` (admin only).
  User manager modal in the header (admin).
- **Person ↔ User link** — DONE. Lock icon on People tab lets admin create a
  login for a staff member.
- **canSignOff flag** — DONE. Per-person sign-off authority (not role-based).
  Admin toggles on People tab. Affects sign-off queue visibility on My Work.
- **Salary visibility** — DONE. Restricted to ADMIN + FINANCE. All other roles
  see `—` in salary column.

### Growth & client layer (done)
10. **Sales & Growth Hub** — DONE. Accounts, Contacts, Leads. Pipeline board.
    Lead → Project conversion. `POST /api/leads/:id/convert`.
11. **Client Hub** — DONE. Account detail view with contacts, linked leads and
    projects.

### Accounting integration (done)
- **Autocount Cloud** — DONE. Push quotations from WON leads, invoices from
  projects. AccountingDocument model tracks all documents with due dates.
  Finance Dashboard shows AR position, overdue alerts, pipeline, health.

### Staffing suggestion engine (done)
12. **Required Skills + Staff Suggestions** — DONE. Producer tags `ProjectSkill` records
    (project ↔ skill join table). `GET /api/projects/:id/staff-suggestions` returns per-skill
    ranked candidates scored by skill rating (60%) + free capacity during project window (40%).
    UI: Required Skills chip-tag section + Suggested Staff ranked panel in project detail.
    Endpoints: `GET /api/projects/all-skills`, `GET/POST/DELETE /api/projects/:id/skills/:skillId`.

### Workflow & productivity (done)
- **Change Requests** — DONE. Per-project formal CRs with PENDING/APPROVED/REJECTED
  status, budget impact, and approval notes. `GET/POST/PATCH/DELETE /api/change-requests`.
- **My Work tab** — DONE. Personal dashboard for all roles — capacity, assigned
  assets, sign-off queue (canSignOff), payment alerts. `GET /api/me/dashboard`.
  CD approve/reject from sign-off queue with rejection note back to REVISION.
- **Email payment alerts** — DONE. Nodemailer digest via SMTP. Configure
  `SMTP_*` vars in `.env`. `POST /api/notifications/payment-alerts`. Trigger from
  Financial tab ("✉ Send alert email").
- **CSV exports** — DONE. Projects, capacity, AR. `GET /api/reports/*`.
- **Project Gantt timeline** — DONE. 16-week SVG view in project detail.
- **Kanban views** — DONE. Assets kanban board in assets.js.

### Sales performance & commissions (done)
- **Sales Performance tab** — DONE. Commission report — attainment %, net profit,
  commission per producer. `GET /api/sales-performance`.
- **CommissionTier** — DONE. Global rate schedule (50/75/100/150%). Admin-editable.
- **SalesTarget** — DONE. Quarterly targets per producer.
- **ProjectCost** — DONE. Per-project cost lines (WARM_POOL / SUPPLIER / ADDITIONAL).
- **PersonTierRate** — DONE. Per-person commission rate override per tier.
- **STAFF role + onboarding flow** — DONE. STAFF has My Work access; onboarding
  flow guides new staff without a linked Person record.

### Deferred
- Kakitangan.com sync (payroll + leave).
- `changedBy` on SkillRatingChange linking to a real Person.

---

## Deployment (on-premise server)

Server: `192.168.1.40` (Debian), user `yeo`, managed by PM2.

```bash
# On the server
cd /opt/pop-os
git pull
npm install
npx prisma generate
npx prisma migrate deploy
node prisma/seed-users.js   # safe: skips if users already exist
npm run build               # REQUIRED — server runs dist/main.js (compiled JS)
pm2 restart pop-os
```

**Important:** The server runs `dist/main.js`, not the TypeScript source directly.
Always run `npm run build` after pulling changes that touch `src/`. If you skip it,
the server starts the old compiled code and new routes/modules won't be registered.

Server `.env` must include all vars from `.env.example` plus Autocount credentials.
The server does NOT use Docker — PostgreSQL runs natively via the system package.

---

## Ownership / domain rules

- Only Producers (YJ, Huey) set/change project priority.
- PM (Emily) owns delivery, workflow compliance, Change Request process.
- Creative Director (Calvin) signs off creative; 3D Director (Tom) signs off 3D.
- A "Drain" = low budget / high complexity → two-signature approval.
- Client changes go through a formal Change Request, not silently absorbed.

---

## Working style requests

- Prefer small, reviewable changes over large rewrites.
- Always show what you're changing and why before applying, especially for
  anything touching `prisma/schema.prisma`, `docker-compose.yml`, or the DB.
- Never introduce a paid service or external dependency without flagging it.
- If a change requires a migration, remind about the stop-server-first rule.
- Match the teaching-comment style already in the codebase.
