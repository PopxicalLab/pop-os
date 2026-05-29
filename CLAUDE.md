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
- **Frontend:** a single static page at `public/index.html` (vanilla JS,
  no framework) served by NestJS. Keep it framework-free and self-contained.
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
- add UI to `public/index.html` if user-facing

Conventions already in use (keep them consistent):
- IDs are `String @id @default(cuid())`.
- Every model has `createdAt` / `updatedAt`.
- Services throw `NotFoundException` / `ConflictException` for clean errors.
- DTOs validate everything; `main.ts` runs a global ValidationPipe with
  `whitelist: true, transform: true`.
- API routes are prefixed `/api`.

---

## Data model (current state)

Built so far: **People / ELC** with **rated skills**.

- **Person** — one record per individual. Fields: name, role, department,
  startDate, employmentType (enum: FULL_TIME/CONTRACT/FREELANCE/INTERN),
  warmPool (bool — Warm Talent Pool / alumni). Has many PersonSkill.

- **Skill** — the studio-wide master list of skills (name is unique).
  Skills are NOT free text on a person; they are shared records, so
  "Rigging" is always spelled the same and is queryable.

- **PersonSkill** — junction: person + skill + current `rating` (Int, 1–5).
  Unique on (personId, skillId). The `rating` is the CURRENT/live score.

- **SkillRatingChange** — audit trail. One row per score movement:
  oldRating (null for the first entry), newRating, source (enum), changedBy
  (free text for now), note, createdAt.

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
2. **Projects** — NEXT. The spine. Carries the PPM framework:
   - quadrant (Gold / Strategic Bet / Operational Filler / Drain)
   - priority (P1 / P2 / P3)
   - status, deadline, client, plus links to a producer (Person) and PM (Person)
   - The "Drain" project type requires a two-signature approval gate
     (Exec/CEO + Producer) before acceptance — model this as a workflow gate,
     likely two fields on Project, not a separate table.
3. **Capacity** — junction of Person × Project per week. One row per
   person-per-project-per-week with role (Main/Support) and pct_week.
   Enforces the 70–80% main / 20–30% support rule. "If it's not on the
   Capacity Board, it doesn't exist." Needs People + Projects first.
   Skill ratings feed staffing decisions here — that's why ratings matter.
4. **Assets** — deliverables that move through the SOP stages
   (Brief → WIP → Internal Review → Revision → Final Delivery), with a
   Creative Director sign-off at Internal Review. Belongs to a Project.

When a SkillRatingChange has source = PROJECT_COMPLETION, it will eventually
link to the real Project record. Until Projects exists, treat it as a label
only — do not create the dependency early (chicken-and-egg).

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
