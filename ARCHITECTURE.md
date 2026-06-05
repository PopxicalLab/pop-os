# Pop OS — Application Architecture

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Language   | TypeScript                        |
| Framework  | NestJS v10                        |
| ORM        | Prisma v5                         |
| Database   | PostgreSQL 16 (Docker)            |
| Frontend   | Vanilla JS + Tailwind CSS (CDN)   |
| Server     | NestJS also serves `public/index.html` via `ServeStaticModule` |

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
│   ├── migrations/            # Auto-generated SQL; never edit manually
│   └── seed.js                # Demo seed: 11 people, 6 projects, capacity history, assets
│
├── public/
│   ├── index.html             # Shell: HTML structure, shared utilities, theme, tab switching
│   └── js/
│       ├── people.js          # People / ELC tab logic
│       ├── projects.js        # Projects tab logic (includes PPM badge)
│       ├── capacity.js        # Capacity board tab logic
│       ├── dashboard.js       # Dashboard command centre tab logic
│       ├── assets.js          # Assets kanban board tab logic
│       ├── production.js      # Production lane board tab logic
│       ├── financial.js       # Financial engine tab logic
│       └── staffing.js        # Staffing recommender tab logic
│
├── src/
│   ├── main.ts                # Bootstrap: starts NestJS, applies global pipes
│   ├── app.module.ts          # Root module — imports all feature modules
│   ├── prisma.service.ts      # Shared DB connection (injected into every service)
│   │
│   ├── people/                # Feature module: People / ELC
│   │   ├── people.dto.ts
│   │   ├── people.service.ts
│   │   ├── people.controller.ts
│   │   └── people.module.ts
│   │
│   ├── skills/                # Feature module: Skill master list + ratings
│   │   ├── skills.dto.ts
│   │   ├── skills.service.ts
│   │   ├── skills.controller.ts
│   │   └── skills.module.ts
│   │
│   ├── projects/              # Feature module: Projects (PPM)
│   │   ├── project.dto.ts
│   │   ├── projects.service.ts
│   │   ├── projects.controller.ts
│   │   └── projects.module.ts
│   │
│   ├── capacity/              # Feature module: Capacity Board
│   │   ├── capacity.dto.ts
│   │   ├── capacity.service.ts
│   │   ├── capacity.controller.ts
│   │   └── capacity.module.ts
│   │
│   ├── dashboard/             # Feature module: Dashboard (read-only aggregation)
│   │   ├── dashboard.service.ts
│   │   ├── dashboard.controller.ts
│   │   └── dashboard.module.ts
│   │
│   ├── ppm/                   # Feature module: PPM recommendation engine
│   │   ├── ppm.service.ts
│   │   ├── ppm.controller.ts
│   │   └── ppm.module.ts
│   │
│   ├── staffing/              # Feature module: Staffing recommender
│   │   ├── staffing.service.ts
│   │   ├── staffing.controller.ts
│   │   └── staffing.module.ts
│   │
│   ├── assets/                # Feature module: Assets (deliverables)
│   │   ├── asset.dto.ts
│   │   ├── assets.service.ts
│   │   ├── assets.controller.ts
│   │   └── assets.module.ts
│   │
│   ├── production/            # Feature module: Production lane routing
│   │   ├── production.service.ts
│   │   ├── production.controller.ts
│   │   └── production.module.ts
│   │
│   └── financial/             # Feature module: Financial engine (man-day costing)
│       ├── financial.service.ts
│       ├── financial.controller.ts
│       └── financial.module.ts
│
├── docker-compose.yml         # Runs PostgreSQL locally
├── .env                       # DATABASE_URL (never committed)
├── CLAUDE.md                  # Technical contract for Claude Code
└── ARCHITECTURE.md            # This file
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

---

## API Routes

All routes are prefixed `/api`.

| Module   | Verb   | Path                    | Description                        |
|----------|--------|-------------------------|------------------------------------|
| People   | GET    | `/api/people`           | List all people                    |
| People   | GET    | `/api/people/:id`       | Get one person (with skill ratings)|
| People   | POST   | `/api/people`           | Create a person                    |
| People   | PATCH  | `/api/people/:id`       | Update a person                    |
| People   | DELETE | `/api/people/:id`       | Remove a person                    |
| Skills   | GET    | `/api/skills`           | List all skills                    |
| Skills   | POST   | `/api/skills`           | Create a skill                     |
| Skills   | DELETE | `/api/skills/:id`       | Remove a skill                     |
| Skills   | POST   | `/api/skills/:id/rate`  | Add/update a person's skill rating |
| Projects | GET    | `/api/projects`         | List all projects                  |
| Projects | GET    | `/api/projects/:id`     | Get one project                    |
| Projects | POST   | `/api/projects`         | Create a project                   |
| Projects | PATCH  | `/api/projects/:id`     | Update a project                   |
| Projects | DELETE | `/api/projects/:id`     | Remove a project                   |
| Capacity  | GET    | `/api/capacity?week=`                          | Board for a week (defaults: now)      |
| Capacity  | GET    | `/api/capacity/:id`                            | Get one allocation                    |
| Capacity  | POST   | `/api/capacity`                                | Add an allocation                     |
| Capacity  | PATCH  | `/api/capacity/:id`                            | Update role or % on an allocation     |
| Capacity  | DELETE | `/api/capacity/:id`                            | Remove an allocation                  |
| Dashboard | GET    | `/api/dashboard`                               | Aggregated stats + this week summary  |
| PPM       | GET    | `/api/ppm`                                     | Score all active projects             |
| PPM       | GET    | `/api/ppm/:id`                                 | Score one project                     |
| Staffing  | GET    | `/api/staffing/recommend?projectId=&weekStart=`| Ranked candidates for a project/week |
| Assets    | GET    | `/api/assets?projectId=`                       | List assets (optionally filtered)     |
| Assets    | GET    | `/api/assets/:id`                              | Get one asset                         |
| Assets    | POST   | `/api/assets`                                  | Create an asset                       |
| Assets    | PATCH  | `/api/assets/:id`                              | Update stage / sign-off / name        |
| Assets    | DELETE | `/api/assets/:id`                              | Remove an asset                       |
| Production| GET    | `/api/production/lanes`                        | Projects grouped by workflow lane     |
| Financial | GET    | `/api/financial/overview`                      | Studio-wide cost summary this week    |
| Financial | GET    | `/api/financial/projects`                      | Per-project cost, margin, RAG health  |

---

## Data Model

```
Company (enum: LPS / PXL)
     │
     ├── Person ──< PersonSkill >── Skill
     │     │              │
     │     │         SkillRatingChange (audit trail)
     │     │
     │     ├──< Project (as Producer)
     │     ├──< Project (as PM)
     │     └──< Capacity >── Project ── Company (enum)
     │                            │
     └── Project ─────────────────┤
                                  └──< Asset (SOP stage pipeline)
```

- **Company** — enum `LPS` / `PXL`. Optional on both Person and Project. Drives the global header filter; untagged records appear under both companies.
- **Person** — one record per individual. Foundation of everything. Has `company?` field.
- **Skill** — studio-wide master list. Shared records, not free text.
- **PersonSkill** — live current rating (1–5) for a person × skill pair.
- **SkillRatingChange** — every score movement. The interview score is just the first entry (source = INTERVIEW).
- **Project** — the spine. PPM quadrant, priority, status, producer/PM links, Drain approval gate, PPM recommendation inputs. Has `company?` field.
- **Capacity** — one row per person × project × week. The Capacity Board. Enforces ≤ 100% total per person per week. Filtered by project's company (not person's) so cross-company lending works correctly.
- **Asset** — one deliverable inside a project. Stage enum: BRIEF/WIP/INTERNAL_REVIEW/REVISION/FINAL_DELIVERY. Flexible — no enforced sequence. CD sign-off soft gate at Internal Review.
- **Person.salary** — optional `Float?`. Annual salary in RM, used by the Financial Engine. Daily rate = `salary × 1.2 / 260`.

---

## Conventions

- IDs are `String @id @default(cuid())` — URL-safe, collision-resistant, sortable.
- Every model has `createdAt` / `updatedAt`.
- Services throw `NotFoundException` / `ConflictException` / `BadRequestException` for clean HTTP errors.
- DTOs validate at the boundary; services trust validated input.
- `weekStart` in Capacity is always normalised to the Monday of the week at UTC midnight — done in the service, not the client.
- **Company filter** — global state `window._company` (null = both). The shared `matchesFilter(company)` function in `index.html` is used by all module JS files. Untagged records (`company = null`) always pass the filter.
- **Module summary strips** — every module tab should open with a compact stats bar above the main content (e.g. "42 active · 8 LPS · 34 PXL"). Implement when building or revisiting each module.
- **Frontend modules** — each tab's JS lives in `public/js/<name>.js`. Adding a tab = new JS file + one `<script src>` line + tab button + panel div in `index.html`.

---

## Roadmap

Six blueprint modules, built in dependency order.

### Foundation
| # | Module | Status |
|---|--------|--------|
| 1 | People / ELC (Talent Vault) | Done |
| 2 | Projects (PPM Engine) | Done |
| 3 | Capacity Board | Done |

### Intelligence layer
| # | Module | Status |
|---|--------|--------|
| 4 | Dashboard — global command centre tab | Done |
| 5 | PPM recommendation engine | Done |
| 6 | Staffing recommendation engine | Done |

### Production layer
| # | Module | Status |
|---|--------|--------|
| 7 | Assets — deliverables through SOP stages | Done |
| 8 | Production Engine / Lane Routing | Done |

### Financial layer
| # | Module | Status |
|---|--------|--------|
| 9 | Financial Engine — man-day costing, actuals tracker | Done |

### Growth & client layer
| # | Module | Status |
|---|--------|--------|
| 10 | Sales & Growth Hub — CRM, lead-to-PPM scoring | Future |
| 11 | Client Hub & DAM — Frame.io, Dropbox/Iconik, Studio Library | Future |
