# Pop OS — Pop Group Studio Operating System

The operating system for Pop Group. Replaces ad-hoc, reactive working with a
structured system: prioritised projects, weekly capacity allocation, a standard
production workflow, deliverable tracking, and a people/skills record.

**Modules built:** People / ELC · Projects (PPM) · Capacity Board · Dashboard ·
PPM Recommendation Engine · Staffing Recommender · Assets

Stack: NestJS + TypeScript + Prisma ORM + PostgreSQL + Tailwind CSS (CDN)

---

## What you need installed first (all free)

1. **Node.js** (v18 or newer) — https://nodejs.org  (the "LTS" version)
2. **Docker Desktop** — https://www.docker.com/products/docker-desktop
   (runs PostgreSQL for you — nothing gets permanently installed on your
   machine, and you can wipe + restart the database with one command)
3. **VS Code** (to edit + debug) — https://code.visualstudio.com

Check the tools are ready — open a terminal and run:
    node --version
    npm --version
    docker --version

---

## Setup (one time)

1. Open this folder in VS Code (File > Open Folder).

2. Make sure **Docker Desktop is running** (launch the app; wait until it
   says it's running).

3. Start the database. In the VS Code terminal:
       docker compose up -d
   This downloads PostgreSQL 16 (first time only) and starts it with a
   database called `pop_os`, user `postgres`, password `postgres`, on the
   standard port 5432 — exactly what the `.env` file already expects, so
   you DON'T need to change anything in `.env`.

   Confirm it's running:
       docker compose ps

4. Install the app's packages:
       npm install

5. Build the database tables from the schema:
       npx prisma migrate dev --name init
   (This reads prisma/schema.prisma and creates the People table for you.)

---

## Run it

    npm run start:dev

> **Upgrading from the first version?** The schema changed (skills are now
> rated 1–5 with history). After `npm install`, run a new migration to
> update your database tables:
>
>     npx prisma migrate dev --name rated_skills
>
> Your existing people are kept. The old free-text "skill tags" are gone
> (they weren't rated), so you'll re-add skills using the new rating UI.
> If anything about the old data gets in the way and you just want a clean
> slate: `docker compose down -v` then `docker compose up -d` and migrate
> again.

Then open your browser at:  http://localhost:3000

You'll see the People / ELC page. Add a person on the left; the list on
the right updates. That's the full loop working: browser -> API ->
database -> back to browser.

`start:dev` auto-restarts when you change code, so leave it running.

---

## Useful extras

- **See your data in a table UI:**  npx prisma studio
  (opens a spreadsheet-like view of the database in your browser)

- **The API endpoints**:
      GET    /api/people                        list everyone (with skills)
      GET    /api/people/:id                    one person
      POST   /api/people                        add
      PATCH  /api/people/:id                    edit
      DELETE /api/people/:id                     remove

      GET    /api/skills                         studio skill master list
      POST   /api/skills                         add a skill to the list
      POST   /api/people/:id/skills              rate a person on a skill
      PATCH  /api/person-skills/:psId/rating     change a rating (logs history)
      GET    /api/person-skills/:psId/history    full change history
      DELETE /api/person-skills/:psId            remove a skill from a person

## Skills & ratings — how it works

Skills are rated 1–5, and every change is recorded with history.

1. Add your studio's skills to the master list (left panel): Modeling,
   Rigging, Animation, etc.
2. On any person, click "+ rate a skill", pick the skill, rating, and the
   source of the score (Interview / Project completion / Manual adjustment).
   The interview score is simply the FIRST entry in that skill's history.
3. Click an existing skill chip to change its rating later — the old and
   new values, who/why, and the date are all logged. A **manual adjustment
   requires a note**; project-completion changes don't.

This history is what makes the score a trajectory ("2→3 after Project X")
rather than just a snapshot — which is what the Capacity Board will use
later for staffing decisions.

---

## Database (Docker) — handy commands

    docker compose up -d        start the database (background)
    docker compose ps           is it running?
    docker compose down         stop it (your data is KEPT)
    docker compose down -v      stop it AND delete all data (fresh start)
    docker compose logs db      see the database logs

Your data lives in a Docker "volume" called pop_os_data, so it survives
`docker compose down` and restarts. Only `down -v` erases it.

---

    prisma/schema.prisma     <- defines the database shape (edit here, then migrate)
    docker-compose.yml       <- runs PostgreSQL in Docker (one command)
    .env                     <- database connection string (matches docker-compose)
    src/main.ts              <- starts the server
    src/app.module.ts        <- ties modules together (add new modules here)
    src/prisma.service.ts    <- the database connection
    src/people/
        person.dto.ts        <- validation rules for incoming data
        people.service.ts    <- the logic (reads/writes the database)
        people.controller.ts <- the URLs (the API)
        people.module.ts     <- bundles the above three together
    public/index.html        <- the web page you see in the browser

When we add Projects next, it's the same five-file pattern in a
src/projects/ folder, plus a few lines in schema.prisma and app.module.ts.
You'll recognise everything.

---

## Debugging in VS Code (you asked about breakpoints!)

1. Open any .ts file, click in the gutter left of a line number to set a
   red breakpoint (try inside `create` in people.service.ts).
2. Press F5. VS Code may ask for an environment — pick Node.js.
3. Add a person in the browser — execution pauses at your breakpoint and
   you can inspect every variable. Exactly like Visual Studio.
