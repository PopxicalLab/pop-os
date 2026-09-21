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
│   ├── seed.js                # Demo seed: people, projects, capacity, assets
│   └── seed-users.js          # Default login accounts (4 roles)
│
├── public/
│   ├── index.html             # Shell: HTML structure, nav, auth check, tab switching
│   ├── login.html             # Animated login page (Lorrypop/Popxical branding)
│   ├── guide.html             # Director's guide — roles, access, how-tos
│   └── js/
│       ├── mywork.js               # My Work personal dashboard
│       ├── dashboard.js            # Cross-module command centre
│       ├── sales.js                # Sales pipeline (leads)
│       ├── clients.js              # Accounts + contacts
│       ├── sales-performance.js    # Commission tracker — tiers, attainment, overrides
│       ├── projects.js             # Projects (PPM) + Gantt timeline + project costs
│       ├── change-requests.js      # Change request tracking
│       ├── assets.js               # Assets kanban board
│       ├── production.js           # Production lane board
│       ├── capacity.js             # Weekly capacity board
│       ├── financial.js            # Financial engine + AR dashboard
│       ├── people.js               # People / ELC tab
│       └── staffing.js             # Staffing recommender
│
├── src/
│   ├── main.ts                # Bootstrap: starts NestJS, global ValidationPipe
│   ├── app.module.ts          # Root module — imports all feature modules
│   ├── prisma.service.ts      # Shared DB connection (injected into every service)
│   │
│   ├── auth/                  # JWT auth — login, token issuance, @Public() decorator
│   ├── users/                 # User accounts (admin only) — email, role, personId link
│   ├── me/                    # Personal dashboard — capacity, assets, sign-off queue
│   │
│   ├── people/                # People / ELC — staff records, canSignOff flag
│   ├── skills/                # Skill master list + PersonSkill ratings + audit trail
│   │
│   ├── projects/              # Projects (PPM) — priority, budget, Drain gate, startDate
│   ├── change-requests/       # Change Requests per project — PENDING/APPROVED/REJECTED
│   │
│   ├── capacity/              # Weekly allocation board (person × project × week)
│   ├── assets/                # Deliverables — SOP stages, reviewUrl, rejectionNote
│   ├── production/            # Production lane routing
│   │
│   ├── accounts/              # Client companies (Autocount debtors)
│   ├── contacts/              # Contacts at client companies
│   ├── leads/                 # Sales leads + pipeline + lead→project conversion + wonAt timestamp
│   │
│   ├── autocount/             # Autocount Cloud integration — push quotes + invoices
│   │
│   ├── project-costs/         # Per-project costs (warm pool, supplier, additional)
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
| Me | GET | `/api/me/dashboard` | Personal dashboard (capacity, assets, sign-off queue) |
| Me | PATCH | `/api/me/sign-off/:id` | CD approve asset from sign-off queue |
| Me | PATCH | `/api/me/reject/:id` | CD reject asset — sends back to REVISION with note |
| Users | GET | `/api/users` | List all users (admin only) |
| Users | POST | `/api/users` | Create a user account |
| Users | PATCH | `/api/users/:id` | Update user (role, active, personId link) |
| Users | DELETE | `/api/users/:id` | Remove user |
| People | GET | `/api/people` | List all people |
| People | GET | `/api/people/:id` | Get one person (with skill ratings) |
| People | POST | `/api/people` | Create a person |
| People | PATCH | `/api/people/:id` | Update a person (incl. canSignOff flag) |
| People | DELETE | `/api/people/:id` | Remove a person |
| Skills | GET | `/api/skills` | List all skills |
| Skills | POST | `/api/skills` | Create a skill |
| Skills | DELETE | `/api/skills/:id` | Remove a skill |
| Skills | POST | `/api/skills/:id/rate` | Add/update a person's skill rating |
| Projects | GET | `/api/projects` | List all projects |
| Projects | GET | `/api/projects/:id` | Get one project |
| Projects | POST | `/api/projects` | Create a project |
| Projects | PATCH | `/api/projects/:id` | Update a project |
| Projects | DELETE | `/api/projects/:id` | Remove a project |
| Change Requests | GET | `/api/change-requests?projectId=&status=` | List CRs (filterable) |
| Change Requests | POST | `/api/change-requests` | Create a CR |
| Change Requests | PATCH | `/api/change-requests/:id` | Update CR (approve / reject + note) |
| Change Requests | DELETE | `/api/change-requests/:id` | Remove a CR |
| Capacity | GET | `/api/capacity?week=` | Board for a week (defaults: this week) |
| Capacity | POST | `/api/capacity` | Add an allocation |
| Capacity | PATCH | `/api/capacity/:id` | Update role or % |
| Capacity | DELETE | `/api/capacity/:id` | Remove an allocation |
| Assets | GET | `/api/assets?projectId=` | List assets (optionally filtered) |
| Assets | GET | `/api/assets/:id` | Get one asset |
| Assets | POST | `/api/assets` | Create an asset |
| Assets | PATCH | `/api/assets/:id` | Update stage / sign-off / reviewUrl / name |
| Assets | DELETE | `/api/assets/:id` | Remove an asset |
| Production | GET | `/api/production/lanes` | Projects grouped by workflow lane |
| Accounts | GET | `/api/accounts` | List client accounts |
| Accounts | POST | `/api/accounts` | Create an account |
| Accounts | PATCH | `/api/accounts/:id` | Update an account |
| Accounts | DELETE | `/api/accounts/:id` | Remove an account |
| Contacts | GET | `/api/contacts?accountId=` | List contacts |
| Contacts | POST | `/api/contacts` | Create a contact |
| Contacts | PATCH | `/api/contacts/:id` | Update a contact |
| Contacts | DELETE | `/api/contacts/:id` | Remove a contact |
| Leads | GET | `/api/leads` | List leads |
| Leads | POST | `/api/leads` | Create a lead |
| Leads | PATCH | `/api/leads/:id` | Update a lead (status, stage, etc.) |
| Leads | DELETE | `/api/leads/:id` | Remove a lead |
| Leads | POST | `/api/leads/:id/convert` | Convert a WON lead to a Project |
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
     │     ├──< Asset (assignedTo)
     │     └── User? (login account)
     │
     ├── Project ──< Asset ──< SOP stages
     │     │           └── reviewUrl, rejectionNote
     │     ├──< Capacity
     │     ├──< ChangeRequest
     │     ├──< ProjectSkill >── Skill
     │     ├──< ProjectCost
     │     ├──< AccountingDocument
     │     └── Account? (client link)
     │
     ├── Account ──< Contact
     │     └──< Lead ──< AccountingDocument (quotations)
     │           └── convertToProject → Project
     │
     ├── User ── Person? (optional link via personId)
     │
     └── NotificationRule ──< NotificationTarget   (CHANNEL by name | USER by userId)
```

### Models

- **Company** — enum `LPS` / `PXL` / `GROUP`. Required on Project; optional on Person, Account, Lead. Drives the global header filter; untagged and `GROUP` records always appear regardless of which company the filter is set to.
- **Person** — one record per staff member. Fields: name, role, department, startDate, employmentType, warmPool, `canSignOff` (grants sign-off authority), `commissionRateOverride` (optional flat rate that bypasses the global tier table), company, salary (monthly RM — ADMIN + FINANCE only).
- **Skill** — studio-wide master list. Shared records, not free text.
- **PersonSkill** — live current rating (1–5) for a person × skill pair.
- **SkillRatingChange** — every score movement. First entry (source = INTERVIEW) is the candidate score.
- **Project** — the spine. PPM quadrant, priority, status, startDate, deadline, budget, producer/PM links, Drain approval gate. Has a required `company` field (LPS/PXL/GROUP).
- **ChangeRequest** — formal change request attached to a project. Status: PENDING / APPROVED / REJECTED. Includes budget impact and approval note.
- **Capacity** — one row per person × project × week. Enforces ≤ 100% total per person per week. `weekStart` always Monday 00:00 UTC.
- **Asset** — one deliverable inside a project. Stage: BRIEF / WIP / INTERNAL_REVIEW / REVISION / FINAL_DELIVERY. `reviewUrl` links to the actual work (Drive, Frame.io). `rejectionNote` stores CD feedback when rejected.
- **Account** — client company. Has `autocountDebtorCode` for Autocount integration.
- **Contact** — person at a client company. Linked to Account.
- **Lead** — sales opportunity. Status: QUALIFICATION → PROPOSAL → NEGOTIATION → WON / LOST. `wonAt` is set automatically when status changes to WON — used to bucket deals into quarters for the commission report. `convertToProject` creates a Project from a WON lead.
- **AccountingDocument** — one Autocount document per row (QUOTATION, SALES_INVOICE, PURCHASE_INVOICE). `dueDate` drives payment alerts and the Finance Dashboard overdue panel.
- **ProjectCost** — a cost line item on a project. Type: `WARM_POOL` / `SUPPLIER` / `ADDITIONAL`. Added from the project detail view. Summed to calculate net profit in the commission report.
- **SalesTarget** — quarterly revenue target per producer. Unique on `(personId, year, quarter)`. Used to calculate attainment %.
- **CommissionTier** — global rate schedule. Each row has a `threshold` (fraction of target, e.g. `0.75` = 75%) and a `rate` (commission fraction, e.g. `0.025` = 2.5%). Seeded with four tiers (50 / 75 / 100 / 150%). Admin-editable from the Performance settings panel.
- **PersonTierRate** — per-person override for a specific CommissionTier row. Takes precedence over the global tier rate for that person × tier combination.
- **NotificationRule** — one Mattermost message the admin has set up. `event` (`CAPACITY_WEEKLY` / `LEAD_CREATED` / `LEAD_STATUS_CHANGED`), `enabled`, optional `company` scope, `dayOfWeek` (1=Mon) + `timeOfDay` (`HH:mm`, always GMT+8) for scheduled events only, event-specific `options` (JSON), and `lastRunAt` / `lastStatus` shown in the Admin UI.
- **NotificationTarget** — a recipient of a rule: `CHANNEL` (Mattermost channel URL name) or `USER` (a Pop OS `userId`, DM'd via their login email, optional `mattermostUsername` override). Deleted with its rule.
- **User** — login credential. Fields: email, name, password (bcrypt), role (7 values: ADMIN / PRODUCER / PM / TEAM_LEAD / FINANCE / SALES / STAFF), active, `personId` (optional FK to Person), `resetTokenHash` / `resetTokenExpiresAt` (self-service password reset — only the bcrypt hash of the token is stored, 1-hour expiry, cleared on use).

---

## Conventions

- IDs are `String @id @default(cuid())` — URL-safe, collision-resistant, sortable.
- Every model has `createdAt` / `updatedAt`.
- Services throw `NotFoundException` / `ConflictException` / `BadRequestException` for clean HTTP errors.
- DTOs validate at the boundary; services trust validated input.
- `weekStart` in Capacity is always normalised to Monday 00:00 UTC — done in the service, not the client.
- **Company filter** — global state `window._company` (null = both). The shared `matchesFilter(company)` in `index.html` is used by all module JS files.
- **Module summary strips** — every module tab opens with a compact stats bar above the main content.
- **Frontend modules** — each tab's JS lives in `public/js/<name>.js`. Adding a tab = new JS file + one `<script src>` line + tab button + panel div in `index.html`.
- **Salary visibility** — `canSeeSalary()` in `people.js` gates salary column, column toggle, and add-form field to ADMIN and FINANCE only.
- **Sign-off authority** — gated by `Person.canSignOff`, not by role. Admin toggles it per person on the People tab.

---

## Roadmap

### Foundation (done)
| # | Module | Status |
|---|---|---|
| 1 | People / ELC | Done |
| 2 | Projects (PPM) | Done |
| 3 | Capacity Board | Done |

### Intelligence layer (done)
| # | Module | Status |
|---|---|---|
| 4 | Dashboard | Done |
| 5 | PPM recommendation engine | Done |
| 6 | Staffing recommendation engine | Done |

### Production layer (done)
| # | Module | Status |
|---|---|---|
| 7 | Assets | Done |
| 8 | Production Engine / Lane Routing | Done |

### Financial layer (done)
| # | Module | Status |
|---|---|---|
| 9 | Financial Engine — man-day costing, actuals, AR | Done |

### Auth & access control (done)
| Feature | Status |
|---|---|
| JWT auth — login page, 6 roles, global guard | Done |
| Users module — admin CRUD | Done |
| Person ↔ User link — lock icon on People tab | Done |
| canSignOff flag — per-person sign-off authority | Done |
| Salary visibility restriction — ADMIN + FINANCE only | Done |
| Password reset — self-service email flow + admin-initiated reset | Done |

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
| Change Requests — per project, PENDING/APPROVED/REJECTED | Done |
| CD review flow — Approve/Reject on sign-off queue with notes | Done |
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
- More triggered events: asset sent for sign-off (DM to sign-off holders), change request submitted / decided, invoice paid / overdue
- Kakitangan.com sync (payroll + leave)
- `changedBy` on SkillRatingChange linking to a real Person
