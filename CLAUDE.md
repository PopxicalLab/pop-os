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
- **UI Framework:** tailwind
- **Frontend:** vanilla JS, no framework, served by NestJS via `ServeStaticModule`.
  `public/index.html` is a thin shell (HTML structure, shared utilities, theme,
  tab switching). Each tab's logic lives in its own file under `public/js/`:
  `people.js`, `projects.js`, `capacity.js`. Adding a new tab = new file + one
  `<script src>` line in `index.html`. Keep it framework-free.
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

### First-time setup on a new machine
1. Install Node.js (v18+) and Docker Desktop
2. `git clone https://github.com/popxicalLab/pop-os.git`
3. Copy env file: `cp .env.example .env` (Mac) or `copy .env.example .env` (Windows)
4. `docker compose up -d`
5. `npm install`
6. `npx prisma migrate deploy`  ← use `deploy` (not `dev`) on a fresh clone
7. `npm run start:dev`

---

## CRITICAL workflow rule (Windows file lock)

**Windows only.** When changing `prisma/schema.prisma`, ALWAYS do it in this order:
1. **Stop** the dev server (Ctrl+C) — releases the Prisma engine file lock.
2. Run `npx prisma migrate dev --name <name>`.
3. **Restart** `npm run start:dev`.

Running a migration while the dev server is live causes a Windows
`EPERM ... rename query_engine-windows.dll.node` error. Stopping the server
first avoids it. Do not skip this on Windows.

**macOS:** This file lock does not exist on Mac. Migrations can be run while
the dev server is running — no need to stop it first.

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

---

## Data model (current state)

Built so far: **People / ELC** with **rated skills**, **Projects** with full
PPM fields, and **Capacity** (weekly allocation board).

- **Company** — enum: `LPS` (Lorrypop Studio) / `PXL` (Popxical Lab). Optional
  field on both Person and Project. Untagged records show under both companies
  in the global filter. Cross-company allocations are valid (a PXL person can
  work on an LPS project). The header logo buttons act as a global filter;
  the active company filters People, Projects, and the Capacity board
  simultaneously.

- **Person** — one record per individual. Fields: name, role, department,
  startDate, employmentType (enum: FULL_TIME/CONTRACT/FREELANCE/INTERN),
  warmPool (bool — Warm Talent Pool / alumni), company (Company? — optional).
  Has many PersonSkill and Capacity entries.

- **Skill** — the studio-wide master list of skills (name is unique).
  Skills are NOT free text on a person; they are shared records, so
  "Rigging" is always spelled the same and is queryable.

- **PersonSkill** — junction: person + skill + current `rating` (Int, 1–5).
  Unique on (personId, skillId). The `rating` is the CURRENT/live score.

- **SkillRatingChange** — audit trail. One row per score movement:
  oldRating (null for the first entry), newRating, source (enum), changedBy
  (free text for now), note, createdAt.

- **Project** — the spine of the production system. Fields: name, client,
  company (Company? — optional), quadrant (enum: GOLD/STRATEGIC_BET/
  OPERATIONAL_FILLER/DRAIN), priority (enum: P1/P2/P3), status (enum:
  BRIEF/IN_PROGRESS/INTERNAL_REVIEW/DELIVERED/ON_HOLD/CANCELLED), deadline,
  producerId → Person, pmId → Person, drainApprovedByExec (bool),
  drainApprovedByProducer (bool).
  PPM inputs (for future recommendation engine): estimatedValue (Float),
  estimatedDuration (Int, weeks), complexityScore (Int, 1–5),
  clientTier (enum: NEW/RETURNING/KEY_ACCOUNT), marginTarget (Float, %).
  Has many Capacity entries.

- **Capacity** — the weekly allocation board. One row per person × project ×
  week. Fields: personId → Person, projectId → Project, weekStart (DateTime —
  always Monday 00:00 UTC, normalised in the service), role (enum: MAIN/
  SUPPORT), pctWeek (Float, 1–100). Unique on (personId, projectId, weekStart).
  Business rules enforced in the service: a person's total pctWeek across all
  projects in a week cannot exceed 100%. MAIN/SUPPORT is a convention
  (70–80% / 20–30%) but not a hard constraint — only the 100% cap is enforced.

### Skills design decisions (do not undo these without asking)

- Ratings are whole numbers 1–5. (Half-steps were deliberately deferred.)
- A skill score is a TRAJECTORY, not a snapshot. Every change writes a
  SkillRatingChange row. The CURRENT rating lives on PersonSkill; its history
  lives in SkillRatingChange. Keep current + history updated together in a
  transaction so they can never drift apart.
- The **interview score is simply the first history entry** with
  source = INTERVIEW. There is no separate "interview" mechanism. A score
  starts at interview, then moves up/down after hire.
- RatingSource enum: INTERVIEW, PROJECT_COMPLETION, MANUAL_ADJUSTMENT.
- **RULE: a MANUAL_ADJUSTMENT requires a `note`.** Other sources may omit it.
  Enforced in the DTO (class-validator `@ValidateIf` + `@IsNotEmpty`) AND
  reflected in the UI (note field shows/required only for manual). Keep both.
- `changedBy` is free text for now; it will later become a link to a Person.
  Don't wire that link until the broader structure is in place.

---

## Roadmap (build order, and why)

The order is driven by dependencies, not preference:

1. **People / ELC** — DONE. The foundation; everything links to a Person.
2. **Projects** — DONE. The spine. PPM quadrant/priority/status, producer/PM
   links, Drain approval gate, PPM recommendation inputs (estimatedValue,
   estimatedDuration, complexityScore, clientTier, marginTarget).
3. **Capacity** — DONE. Weekly allocation board (Person × Project × week).
   Role (MAIN/SUPPORT), pctWeek (1–100), 100% cap enforced per person per week.
   Global company filter (LPS/PXL) applies here too — filters by project company
   so cross-company (lent) people still appear when their project matches.
4. **Dashboard** — NEXT. Home tab. Aggregates data from all modules: active
   project count, who has capacity this week, leave/absence gaps, overdue
   projects. Note: leave is not yet in the data model — Capacity only tracks
   project allocations, not absence.
5. **Assets** — deliverables that move through the SOP stages
   (Brief → WIP → Internal Review → Revision → Final Delivery), with a
   Creative Director sign-off at Internal Review. Belongs to a Project.
6. **PPM recommendation engine** — uses the PPM input fields on Project plus
   historical project outcomes to suggest quadrant and priority. Rule-based
   scoring first, Claude API reasoning layer later.
7. **Staffing recommendation engine** — given a project's quadrant/priority
   and required skills, recommends who to assign based on current capacity
   and skill ratings.

When a SkillRatingChange has source = PROJECT_COMPLETION, it will eventually
link to the real Project record. The foreign key is intentionally deferred —
do not add it until the staffing engine requires it.

---

## Ownership / domain rules (from the Action Plan — useful context)

- Only Producers (YJ, Huey) set/change project priority.
- PM (Emily) owns delivery, workflow compliance, the Change Request process,
  and is the first escalation point.
- Creative Director (Calvin) signs off creative; 3D Director (Tom) signs off
  3D technical. Directors own quality, not scheduling.
- A "Drain" = low budget / high complexity / high maintenance → two signatures.
- Client changes go through a formal Change Request (impact assessed before
  execution), not silently absorbed.

These inform validation and workflow logic but don't all need building now.

---

## Working style requests

- Prefer small, reviewable changes over large rewrites.
- Always show what you're changing and why before applying, especially for
  anything touching `prisma/schema.prisma`, `docker-compose.yml`, or the DB.
- Never introduce a paid service or external dependency without flagging it.
- If a change requires a migration, remind about the stop-server-first rule.
- Match the teaching-comment style already in the codebase.
