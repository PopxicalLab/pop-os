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
│   └── migrations/            # Auto-generated SQL; never edit manually
│
├── public/
│   └── index.html             # The entire frontend (vanilla JS, no framework)
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
│   └── capacity/              # Feature module: Capacity Board
│       ├── capacity.dto.ts
│       ├── capacity.service.ts
│       ├── capacity.controller.ts
│       └── capacity.module.ts
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
| Capacity | GET    | `/api/capacity?week=`   | Board for a week (defaults: now)   |
| Capacity | GET    | `/api/capacity/:id`     | Get one allocation                 |
| Capacity | POST   | `/api/capacity`         | Add an allocation                  |
| Capacity | PATCH  | `/api/capacity/:id`     | Update role or % on an allocation  |
| Capacity | DELETE | `/api/capacity/:id`     | Remove an allocation               |

---

## Data Model

```
Person ──< PersonSkill >── Skill
  │              │
  │         SkillRatingChange (audit trail)
  │
  ├──< Project (as Producer)
  ├──< Project (as PM)
  └──< Capacity >── Project
```

- **Person** — one record per individual. Foundation of everything.
- **Skill** — studio-wide master list. Shared records, not free text.
- **PersonSkill** — live current rating (1–5) for a person × skill pair.
- **SkillRatingChange** — every score movement. The interview score is just the first entry (source = INTERVIEW).
- **Project** — the spine. PPM quadrant, priority, status, producer/PM links, Drain approval gate, PPM recommendation inputs.
- **Capacity** — one row per person × project × week. The Capacity Board. Enforces ≤ 100% total per person per week.

---

## Conventions

- IDs are `String @id @default(cuid())` — URL-safe, collision-resistant, sortable.
- Every model has `createdAt` / `updatedAt`.
- Services throw `NotFoundException` / `ConflictException` / `BadRequestException` for clean HTTP errors.
- DTOs validate at the boundary; services trust validated input.
- `weekStart` in Capacity is always normalised to the Monday of the week at UTC midnight — done in the service, not the client.

---

## Roadmap

| # | Module         | Status  |
|---|----------------|---------|
| 1 | People / ELC   | Done    |
| 2 | Projects       | Done    |
| 3 | Capacity       | Done    |
| 4 | Assets         | Next    |
| 5 | PPM engine     | Future  |
| 6 | Staffing engine| Future  |
