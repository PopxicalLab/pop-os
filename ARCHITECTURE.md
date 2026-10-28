# Pop OS — Application Architecture

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Language   | TypeScript                        |
| Framework  | NestJS v10                        |
| ORM        | Prisma v5                         |
| Database   | PostgreSQL 16 (Docker locally; native on server) |
| Frontend   | Vanilla JS + Tailwind CSS (CDN)   |
| Auth       | JWT via `@nestjs/jwt`; global `JwtAuthGuard`; `@Public()` decorator for open routes |
| Email      | nodemailer (SMTP) for payment due alerts |
| Server     | NestJS serves `public/` via `ServeStaticModule` on port 3000 |

---

## Layered Architecture

Every HTTP request flows through exactly three layers in order. Nothing skips a layer.

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────────┐
│  Controller  (.controller.ts)               │
│  "Which URL? Which verb? Which params?"     │
│  Extracts request data, calls the service,  │
│  returns the result as JSON.                │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│  Service  (.service.ts)                     │
│  "What is the business logic?"              │
│  Validates domain rules, orchestrates DB    │
│  calls, throws domain errors.               │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│  Prisma / PostgreSQL                        │
│  "Read or write the data."                  │
│  Type-safe query builder; abstracts SQL.    │
└─────────────────────────────────────────────┘
```

---

## Folder Structure

```
pop-os/
├── prisma/
│   ├── schema.prisma          # Single source of truth for the DB shape
│   ├── migrations/            # SQL migration files — never edit manually
│   ├── seed.js                # Demo seed: people, projects, capacity, leads
│   └── seed-users.js          # Default login accounts (4 roles)
│
├── public/
│   ├── index.html             # The Dashboard page itself — NOT an SPA shell;
│   │                          #   every tab below is its own standalone page
│   ├── login.html             # Animated login page (Lorrypop/Popxical branding)
│   ├── guide.html             # Director's guide — roles, access, how-tos
│   ├── jobs.html / job.html / sales.html / clients.html / sp.html /
│   │   projects.html / production.html / capacity.html / financial.html /
│   │   people.html / committees.html / staffing.html / admin.html /
│   │   mywork.html / self-assess.html / skills-guide.html / changelog.html /
│   │   reset-password.html    # One standalone page per tab, sharing shared.js
│   └── js/
│       ├── mywork.js               # My Work personal dashboard
│       ├── dashboard.js            # Cross-module command centre
│       ├── jobs.js / job.js        # Jobs list / one job (sales + production + money)
│       ├── sales.js / sales-list.js    # Sales pipeline (kanban) / List sub-tab
│       ├── clients.js              # Accounts + contacts
│       ├── sales-performance.js    # Commission tracker — tiers, attainment, overrides
│       ├── projects.js             # Projects — production only (dates, team, skills, capacity)
│       ├── production.js           # Production lane board
│       ├── capacity.js             # Weekly capacity board
│       ├── financial.js            # Financial engine + AR dashboard
│       ├── people.js / person-profile.js   # People / ELC tab / one person's profile
│       ├── committees.js           # Committees — members, activities, attendees
│       ├── staffing.js             # Staffing recommender
│       ├── audit.js / admin-notifications.js   # Admin ▾ Audit Log / Mattermost notification rules
│       └── shared.js               # $, esc, fmtMoney, matchesFilter, TAB_ACCESS, renderHeader, …
│
├── src/
│   ├── main.ts                # Bootstrap: starts NestJS, global ValidationPipe
│   ├── app.module.ts          # Root module — imports all feature modules
│   ├── prisma.service.ts      # Shared DB connection (injected into every service)
│   ├── common/                # roles.ts (JOB_ROLES/FINANCE_ROLES/onlyRoles/canSeeMoney),
│   │                          #   job.ts (JOB_FIELDS/withJobFields/ensureJobForProject), uploads.ts
│   │
│   ├── auth/                  # JWT auth — login, token issuance, @Public() decorator
│   ├── users/                 # User accounts (admin only) — email, role, personId link
│   ├── me/                    # Personal dashboard — capacity, projects
│   ├── audit/                 # Immutable AuditLog — CREATE/UPDATE/DELETE across the app
│   │
│   ├── people/                # People / ELC — staff records, skills, profile
│   ├── skills/                # Skill master list + PersonSkill ratings + audit trail
│   ├── job-titles/            # Job title master list (Person.role picks from these)
│   ├── departments/           # Department master list (Person.department)
│   ├── software/              # Software-skill master list + per-person proficiency
│   ├── self-assess/           # Self-assessment skill submissions (admin approve/reject)
│   ├── committees/            # Committees — members, activities, attendee tracking
│   │
│   ├── projects/              # Projects — production only: dates, team, priority, skills, capacity
│   ├── capacity/              # Weekly allocation board (person × project × week)
│   ├── production/            # Production lane routing
│   │
│   ├── accounts/              # Client companies (Autocount debtors)
│   ├── contacts/              # Contacts at client companies
│   ├── leads/                 # Sales leads + pipeline + ALL money/PPM + lead→project conversion
│   ├── jobs/                  # Read-only: a won lead + its project, one money+production view
│   ├── job-attachments/       # Files on a job (contract/PO/invoice/receipt) — disk + index row
│   │
│   ├── autocount/             # Autocount Cloud integration — push quotes + invoices
│   │
│   ├── project-costs/         # Costs against a lead (warm pool, supplier, additional)
│   ├── commission-tiers/      # Global attainment-based commission rate table
│   ├── sales-targets/         # Quarterly targets per producer
│   ├── sales-performance/     # Commission calculator — attainment, net profit, overrides
│   │
│   ├── dashboard/             # Dashboard aggregation (cross-module read)
│   ├── ppm/                   # PPM recommendation engine
│   ├── staffing/              # Staffing recommendation engine
│   ├── financial/             # Financial engine — man-day costing, AR, health RAG
│   │
│   ├── reports/               # CSV exports — projects, capacity, AR
│   ├── notifications/         # Email alerts — payment due digest via nodemailer
│   └── mattermost/            # Mattermost bot client, notification rules, 1-min scheduler,
│                              #   event catalogue + message formatters (capacity board, leads)
│
├── docker-compose.yml         # Runs PostgreSQL locally (dev only)
├── .env                       # Secrets — DATABASE_URL, JWT_SECRET, SMTP_*, AUTOCOUNT_*, MATTERMOST_*
├── .env.example               # Template — copy to .env and fill in values
├── CLAUDE.md                  # Technical contract for Claude Code
├── ARCHITECTURE.md            # This file
├── README.md                  # Setup guide and quick reference
└── docs/
    └── server-setup.md        # Full server provisioning guide (Debian)
```

---

## Design Patterns

### 1. Feature Modules
Each business domain is a self-contained folder with the same four files (DTO, service, controller, module). Adding a new domain means dropping in a new folder and registering it in `app.module.ts` — nothing else changes.

### 2. Dependency Injection (DI)
Classes declare what they need in their constructor; NestJS supplies it.

```typescript
@Injectable()
export class CapacityService {
  constructor(private prisma: PrismaService) {}  // NestJS injects this
}
```

Same concept as ASP.NET Core's `services.AddScoped<>()`.

### 3. DTO Pattern (Data Transfer Objects)
DTOs define the shape and validation rules for data coming *into* the API. They are separate from Prisma models because what the API accepts and what the DB stores are often different (e.g., a date string vs. a normalised `DateTime`).

```typescript
export class CreateCapacityDto {
  @IsNumber() @Min(1) @Max(100)
  pctWeek: number;           // validated before the service ever sees it
}
```

A global `ValidationPipe` in `main.ts` runs every request body through these rules automatically. Bad data is rejected with a 400 before hitting the service.

### 4. Repository Pattern (via Prisma)
Services never write raw SQL. `PrismaService` is the data access layer — it abstracts the database and returns fully typed results.

```typescript
this.prisma.capacity.findMany({ where: { weekStart }, include: WITH_DETAILS })
```

### 5. Decorator Pattern
NestJS uses TypeScript decorators to configure routing, validation, and injection without boilerplate:

```typescript
@Controller('api/capacity')
export class CapacityController {
  @Get()
  findByWeek(@Query('week') week?: string) { ... }

  @Post()
  create(@Body() dto: CreateCapacityDto) { ... }
}
```

### 6. Auth Pattern
A global `JwtAuthGuard` locks every route by default. Routes that should be public (login, health check) are marked with `@Public()`. Role checks use `@Roles()` where needed.

Token is stored in `localStorage` as `pop-os-token`. The `window.fetch` override in `index.html` injects `Authorization: Bearer <token>` on every request automatically — tab JS files need no changes.

---

## API Routes

All routes are prefixed `/api` and JWT-guarded unless marked public.

| Module | Verb | Path | Description |
|---|---|---|---|
| Auth | POST | `/api/auth/login` | @Public — issue JWT token |
| Auth | GET | `/api/auth/me` | Current user profile |
| Auth | POST | `/api/auth/forgot-password` | @Public — email a reset link (generic response either way) |
| Auth | POST | `/api/auth/reset-password` | @Public — verify token + expiry, set new password |
| Me | GET | `/api/me/dashboard` | Personal dashboard (capacity, projects, payment alerts) |
| Users | GET | `/api/users` | List all users (admin only) |
| Users | POST | `/api/users` | Create a user account |
| Users | PATCH | `/api/users/:id` | Update user (role, active, personId link) |
| Users | DELETE | `/api/users/:id` | Remove user |
| People | GET | `/api/people` | List all people |
| People | GET | `/api/people/:id` | Get one person (with skill ratings) |
| People | POST | `/api/people` | Create a person |
| People | PATCH | `/api/people/:id` | Update a person |
| People | DELETE | `/api/people/:id` | Remove a person |
| Skills | GET | `/api/skills` | List all skills |
| Skills | POST | `/api/skills` | Create a skill |
| Skills | DELETE | `/api/skills/:id` | Remove a skill |
| Skills | POST | `/api/skills/:id/rate` | Add/update a person's skill rating |
| Projects | GET | `/api/projects` | List all projects — production fields only, no money/PPM for anyone |
| Projects | GET | `/api/projects/:id` | Get one project (production only) |
| Projects | POST | `/api/projects` | Create a project — gets an auto job (`job_<projectId>`) via `ensureJobForProject` |
| Projects | PATCH | `/api/projects/:id` | Update a project — `UpdateProjectDto` has no money/PPM fields, so it can't write them |
| Projects | DELETE | `/api/projects/:id` | Remove a project (deletes its auto job's upload folder too) |
| Capacity | GET | `/api/capacity?week=` | Board for a week (defaults: this week) |
| Capacity | POST | `/api/capacity` | Add an allocation |
| Capacity | PATCH | `/api/capacity/:id` | Update role or % |
| Capacity | DELETE | `/api/capacity/:id` | Remove an allocation |
| Production | GET | `/api/production/lanes` | Projects grouped by workflow lane |
| Accounts | GET | `/api/accounts` | List client accounts |
| Accounts | POST | `/api/accounts` | Create an account |
| Accounts | PATCH | `/api/accounts/:id` | Update an account |
| Accounts | DELETE | `/api/accounts/:id` | Remove an account |
| Contacts | GET | `/api/contacts?accountId=` | List contacts |
| Contacts | POST | `/api/contacts` | Create a contact |
| Contacts | PATCH | `/api/contacts/:id` | Update a contact |
| Contacts | DELETE | `/api/contacts/:id` | Remove a contact |
| Leads | GET | `/api/leads` | List leads — job roles only (carries all money + PPM) |
| Leads | POST | `/api/leads` | Create a lead |
| Leads | PATCH | `/api/leads/:id` | Update a lead (status, stage, money, PPM — `JOB_OWNED_FIELDS` also sync the mirror onto its Project) |
| Leads | DELETE | `/api/leads/:id` | Remove a lead |
| Leads | POST | `/api/leads/:id/convert` | Convert a WON lead to a Project (refused for an un-approved DRAIN) |
| Jobs | GET | `/api/jobs` | List every won deal — sales + production + money, job roles only |
| Jobs | GET | `/api/jobs/:id` | One job (read-only — edit via `/api/leads`, `/api/projects`, `/api/project-costs`) |
| Job Attachments | GET | `/api/job-attachments?leadId=` | List files on a job — job roles only |
| Job Attachments | POST | `/api/job-attachments/:leadId` | Upload a file (multipart, 25 MB, extension-whitelisted) |
| Job Attachments | GET | `/api/job-attachments/:id/file` | Download (`?inline=1` to preview PDF/image) |
| Job Attachments | PATCH | `/api/job-attachments/:id` | Update category / note |
| Job Attachments | DELETE | `/api/job-attachments/:id` | Remove a file (and its bytes on disk) |
| Dashboard | GET | `/api/dashboard` | Aggregated stats + this week summary |
| PPM | GET | `/api/ppm` | Score all active projects |
| PPM | GET | `/api/ppm/:id` | Score one project |
| Staffing | GET | `/api/staffing/recommend?projectId=&weekStart=` | Ranked candidates |
| Financial | GET | `/api/financial/overview` | Studio-wide cost summary |
| Financial | GET | `/api/financial/projects` | Per-project cost, margin, RAG health |
| Financial | GET | `/api/financial/dashboard` | AR KPIs, overdue, due-soon, pipeline |
| Autocount | GET | `/api/autocount/debtors` | List Autocount debtor accounts |
| Autocount | POST | `/api/autocount/leads/:id/quotation` | Push quotation for a WON lead |
| Autocount | POST | `/api/autocount/projects/:id/invoice` | Push sales invoice for a project |
| Autocount | PATCH | `/api/autocount/documents/:id/status` | Mark document PAID or VOID |
| Autocount | GET | `/api/autocount/due-soon` | Docs due within N days |
| Project Costs | GET | `/api/project-costs?projectId=` | List costs for a project |
| Project Costs | POST | `/api/project-costs` | Add a cost entry (WARM_POOL / SUPPLIER / ADDITIONAL) |
| Project Costs | PATCH | `/api/project-costs/:id` | Update a cost entry |
| Project Costs | DELETE | `/api/project-costs/:id` | Remove a cost entry |
| Commission Tiers | GET | `/api/commission-tiers` | List global attainment tiers |
| Commission Tiers | PATCH | `/api/commission-tiers/:id` | Update a tier (threshold, rate, label) |
| Sales Targets | GET | `/api/sales-targets?year=` | List targets (filterable by year) |
| Sales Targets | POST | `/api/sales-targets` | Set/upsert a quarterly target for a producer |
| Sales Targets | DELETE | `/api/sales-targets/:id` | Remove a target |
| Sales Performance | GET | `/api/sales-performance?year=&quarter=` | Commission report — attainment, net profit, commission per producer |
| Reports | GET | `/api/reports/projects` | CSV export — all projects |
| Reports | GET | `/api/reports/capacity` | CSV export — current week capacity |
| Reports | GET | `/api/reports/ar` | CSV export — AR / accounting documents |
| Notifications | POST | `/api/notifications/payment-alerts` | Send payment due alert email digest |
| Notification Rules | GET | `/api/notification-rules` | ADMIN. Rules + event catalogue + option choices (`configured`, `events`, `capacitySections`, `leadStatuses`, `departments`, `rules`) |
| Notification Rules | POST | `/api/notification-rules` | ADMIN. Create a rule (event, company scope, schedule for scheduled events, `options`, `targets`) |
| Notification Rules | PATCH | `/api/notification-rules/:id` | ADMIN. Edit a rule (`targets`, when sent, replace the whole list) |
| Notification Rules | DELETE | `/api/notification-rules/:id` | ADMIN. Delete a rule (targets cascade) |
| Notification Rules | POST | `/api/notification-rules/:id/test` | ADMIN. Post a test message (sample data for triggered events) |
| Notification Rules | POST | `/api/notification-rules/:id/run` | ADMIN. Send a scheduled rule now (refused for triggered rules) |

---

## Data Model

```
Company (enum: LPS / PXL / GROUP)
     │
     ├── Person ──< PersonSkill >── Skill
     │     │              │
     │     │         SkillRatingChange (audit trail)
     │     │
     │     ├──< Capacity >── Project
     │     ├──< CommitteeMember >── Committee ──< CommitteeActivity ──< CommitteeActivityAttendee
     │     └── User? (login account)
     │
     ├── Project  (production only — no money, no PPM)
     │     ├──< Capacity
     │     ├──< ProjectSkill >── Skill
     │     └── Account? (client link)
     │     one job ── Lead  (see "Job" below)
     │
     ├── Account ──< Contact
     │     └──< Lead  (ALL money + PPM live here)
     │           ├──< AccountingDocument (quotations/invoices)
     │           ├──< ProjectCost (warm pool / supplier / additional)
     │           ├──< JobAttachment (contract/PO/invoice/receipt — bytes on disk)
     │           └── convertToProject → Project (DRAIN blocked without both approvals)
     │
     ├── User ── Person? (optional link via personId)
     │
     └── NotificationRule ──< NotificationTarget   (CHANNEL by name | USER by userId)
```

### Models

- **Company** — enum `LPS` / `PXL` / `GROUP`. Required on Project; optional on Person, Account, Lead. Drives the global header filter; untagged and `GROUP` records always appear regardless of which company the filter is set to.
- **Person** — one record per staff member. Fields: name, role (from the JobTitle list), department (from the Department list), startDate, employmentType, warmPool, `commissionRateOverride` (optional flat rate that bypasses the global tier table), company, salary (monthly RM — ADMIN + FINANCE only), `showInCapacityReports` (false = left out of person-level capacity summaries — Mattermost weekly post, Dashboard, Capacity "unallocated" strip, staffing suggestions — but still bookable and still shown under a project).
- **Skill** — studio-wide master list. Shared records, not free text.
- **PersonSkill** — live current rating (1–5) for a person × skill pair.
- **SkillRatingChange** — every score movement. First entry (source = INTERVIEW) is the candidate score.
- **JobTitle / Department / Software** — small master lists feeding Person's role, department, and tracked software-skill proficiency dropdowns. Admin-managed, not free text.
- **SelfAssessmentRating** — a person's own skill self-assessment submission, admin approve/reject before it lands on PersonSkill.
- **Committee / CommitteeMember / CommitteeActivity / CommitteeActivityAttendee** — committee membership (role, joined/left) and a log of sessions (meeting/audit/review) with attendance.
- **"Job" — not a table, a role a Lead plays.** A won lead (WON / COMPLETED status, or any lead with a project) is the root of the deal: the Lead carries all the money (`estimatedValue`, `marginTarget`, `clientTier`, `invoicedPct`/`paidPct`, costs, Autocount docs) *and* the PPM assessment (`quadrant`, `complexityScore`, `estimatedDuration`, Drain approvals). The Project it spawns is production-only — dates, team, priority, skills, capacity, and a `quadrant` that's a read-only mirror of the job's (kept in sync by `LeadsService.update()` / `ensureJobForProject`). Every Project has exactly one job; one made directly on the Projects tab gets an auto job (`job_<projectId>`, no closer, never counted in commission). The Jobs tab/API is a read-only merged view over Lead + Project — edits still go through `/api/leads`, `/api/projects`, `/api/project-costs`. Job roles (ADMIN, PRODUCER, PM, FINANCE, SALES) see money; TEAM_LEAD/STAFF never do, not even in API responses — see `src/common/roles.ts` / `JOB_ROLES`.
- **Project** — production only: PPM quadrant (mirrored from its job), priority, status, startDate, deadline, producer/PM links, Drain approval gate, required `company` (LPS/PXL/GROUP). Still has old `estimatedValue`/`marginTarget`/`clientTier`/`client`/`complexityScore`/`estimatedDuration`/Drain-approval columns and `ProjectCost.projectId` — unused since the Sept 2026 split, pending a cleanup migration (see CLAUDE.md "step 4").
- **Capacity** — one row per person × project × week. Enforces ≤ 100% total per person per week. `weekStart` always Monday 00:00 UTC.
- **Account** — client company. Has `autocountDebtorCode` for Autocount integration.
- **Contact** — person at a client company. Linked to Account.
- **Lead** — sales opportunity *and* the money/PPM record for its job (see "Job" above). Status: QUALIFICATION → PROPOSAL → NEGOTIATION → WON → COMPLETED / LOST. `wonAt` is set automatically when status changes to WON — used to bucket deals into quarters for the commission report. `convertToProject` creates a Project from a WON lead.
- **JobAttachment** — a file uploaded to a job (contract, PO, invoice, receipt, brief…). Bytes live on disk under `UPLOAD_DIR` (default `<app>/uploads`, git-ignored — **not** backed up by `pg_dump`), this row is just the index: category, original filename, random stored name, size, uploader. Job roles only.
- **AccountingDocument** — one Autocount document per row (QUOTATION, SALES_INVOICE, PURCHASE_INVOICE). `dueDate` drives payment alerts and the Finance Dashboard overdue panel.
- **ProjectCost** — a cost line item against a lead/job. Type: `WARM_POOL` / `SUPPLIER` / `ADDITIONAL`. Summed to calculate net profit in the commission report.
- **SalesTarget** — quarterly revenue target per producer. Unique on `(personId, year, quarter)`. Used to calculate attainment %.
- **CommissionTier** — global rate schedule. Each row has a `threshold` (fraction of target, e.g. `0.75` = 75%) and a `rate` (commission fraction, e.g. `0.025` = 2.5%). Seeded with four tiers (50 / 75 / 100 / 150%). Admin-editable from the Performance settings panel.
- **PersonTierRate** — per-person override for a specific CommissionTier row. Takes precedence over the global tier rate for that person × tier combination.
- **NotificationRule** — one Mattermost message the admin has set up. `event` (`CAPACITY_WEEKLY` / `LEAD_CREATED` / `LEAD_STATUS_CHANGED`), `enabled`, optional `company` scope, `dayOfWeek` (1=Mon) + `timeOfDay` (`HH:mm`, always GMT+8) for scheduled events only, event-specific `options` (JSON), and `lastRunAt` / `lastStatus` shown in the Admin UI.
- **NotificationTarget** — a recipient of a rule: `CHANNEL` (Mattermost channel URL name) or `USER` (a Pop OS `userId`, DM'd via their login email, optional `mattermostUsername` override). Deleted with its rule.
- **User** — login credential. Fields: email, name, password (bcrypt), role (7 values: ADMIN / PRODUCER / PM / TEAM_LEAD / FINANCE / SALES / STAFF), active, `personId` (optional FK to Person), `resetTokenHash` / `resetTokenExpiresAt` (self-service password reset — only the bcrypt hash of the token is stored, 1-hour expiry, cleared on use).
- **AuditLog** — immutable CREATE/UPDATE/DELETE record across Leads, Projects, People, Users, AccountingDocuments, NotificationRules. Written fire-and-forget; never blocks a request.

---

## Conventions

- IDs are `String @id @default(cuid())` — URL-safe, collision-resistant, sortable.
- Every model has `createdAt` / `updatedAt`.
- Services throw `NotFoundException` / `ConflictException` / `BadRequestException` for clean HTTP errors.
- DTOs validate at the boundary; services trust validated input.
- `weekStart` in Capacity is always normalised to Monday 00:00 UTC — done in the service, not the client.
- **Company filter** — global state `window._company` (null = both). The shared `matchesFilter(company)` in `shared.js` is used by every page's JS.
- **Module summary strips** — every module tab opens with a compact stats bar above the main content.
- **Frontend pages** — every tab is its own standalone `public/<name>.html` page (not an SPA) sharing `public/js/shared.js` for header/nav/auth/theme/fetch. Adding a tab = new `<name>.html` + `<name>.js` + an entry in `shared.js`'s `TAB_ACCESS` map + a nav link.
- **Money formatting** — every ringgit amount goes through `fmtMoney(n)` in `shared.js` (handles cents, not just whole ringgit). Never hand-roll `Math.round()` or `maximumFractionDigits: 0` on a money value.
- **Salary visibility** — `canSeeSalary()` in `people.js` gates salary column, column toggle, and add-form field to ADMIN and FINANCE only.

---

## Roadmap

### Foundation (done)
| # | Module | Status |
|---|---|---|
| 1 | People / ELC | Done |
| 2 | Projects (PPM) | Done |
| 3 | Capacity Board | Done |

### People & org records (done)
| Feature | Status |
|---|---|
| JobTitle / Department master lists — feed Person's role/department dropdowns | Done |
| Software skill tracking — master list + per-person proficiency | Done |
| Self-assessment — person submits a skill rating, admin approves/rejects | Done |
| Committees — membership (role, joined/left) + logged activities with attendance | Done |
| `showInCapacityReports` flag — excludes a person from capacity summaries, still bookable | Done |

### Intelligence layer (done)
| # | Module | Status |
|---|---|---|
| 4 | Dashboard | Done |
| 5 | PPM recommendation engine | Done |
| 6 | Staffing recommendation engine | Done |

### Production layer (done)
| # | Module | Status |
|---|---|---|
| 7 | Assets | Removed Sept 2026 — moved to external PM tool |
| 8 | Production Engine / Lane Routing | Done |

### Financial layer (done)
| # | Module | Status |
|---|---|---|
| 9 | Financial Engine — man-day costing, actuals, AR | Done |

### Auth & access control (done)
| Feature | Status |
|---|---|
| JWT auth — login page, 7 roles, global guard | Done |
| Users module — admin CRUD | Done |
| Person ↔ User link — lock icon on People tab | Done |
| canSignOff flag — per-person sign-off authority | Removed Sept 2026 |
| Salary visibility restriction — ADMIN + FINANCE only | Done |
| Password reset — self-service email flow + admin-initiated reset | Done |
| Page guard — `renderHeader()` redirects a role to My Work on a tab it can't access | Done |

### Job restructure (Sept 2026, done)
| Feature | Status |
|---|---|
| Money split: Lead carries all money + PPM; Project is production-only | Done |
| Project money/PPM columns dropped from `UpdateProjectDto` — API can't write them | Done |
| `src/common/roles.ts` — `JOB_ROLES`/`FINANCE_ROLES`/`onlyRoles()`/`canSeeMoney()` | Done |
| Jobs tab/API — read-only merged view of a won lead + its project | Done |
| Auto job (`job_<projectId>`) for projects made directly on the Projects tab | Done |
| Job Attachments — upload contracts/POs/invoices/receipts to a job, disk + index row | Done |
| Pending: drop the now-unused money/PPM columns from `Project` in a later migration | Deferred |

### Growth & client layer (done)
| # | Module | Status |
|---|---|---|
| 10 | Sales & Growth Hub — Accounts, Contacts, Leads, pipeline | Done |
| 11 | Client Hub — account detail, linked leads + projects | Done |

### Accounting integration (done)
| Feature | Status |
|---|---|
| Autocount Cloud — push quotations + invoices | Done |
| AccountingDocument — track all docs with due dates | Done |
| Finance Dashboard — AR position, overdue, pipeline, health | Done |

### Workflow & productivity (done)
| Feature | Status |
|---|---|
| Change Requests — per project, PENDING/APPROVED/REJECTED | Removed Sept 2026 — moved to external PM tool |
| CD review flow — Approve/Reject on sign-off queue with notes | Removed Sept 2026 |
| My Work tab — personal dashboard per role | Done |
| CSV exports — projects, capacity, AR | Done |
| Email payment alerts — nodemailer digest | Done |
| Project Gantt timeline — 16-week SVG view | Done |

### Sales performance & commissions (done)
| Feature | Status |
|---|---|
| Sales Performance tab (admin/sales director) | Done |
| Global attainment-based commission tiers (50/75/100/150%) | Done |
| Per-person `commissionRateOverride` — bypasses tier table | Done |
| Quarterly sales targets per producer — set from Settings panel | Done |
| Project Costs — add warm pool / supplier / additional costs per project | Done |
| Commission calculation: `(revenue − costs) × rate`, bucketed by `wonAt` quarter | Done |

### Notifications (done)
| Feature | Status |
|---|---|
| Mattermost bot client — channel posts and DMs from one bot token | Done |
| Admin-configured notification rules (Admin tab) with Send test / Run now | Done |
| Scheduled event: weekly capacity board (sections, this/next week, company + department scope) | Done |
| Triggered events: lead created, lead status changed (stage filter, value toggle, @mention closer) | Done |
| Rule create / edit / delete recorded in the Audit Log | Done |
| WhatsApp lead messages retired — module, `whatsapp-web.js` / Puppeteer deps and `WHATSAPP_*` env vars removed | Done |

### Deferred
- More triggered events: invoice paid / overdue
- Kakitangan.com sync (payroll + leave)
- `changedBy` on SkillRatingChange linking to a real Person
