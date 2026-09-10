# Changelog

All notable changes to Pop OS are recorded here, newest first. This is a
user-facing summary — internal refactors, dependency bumps, and doc-only
commits are omitted. The in-app version of this page is linked from the
user menu (top right, after login) → **What's new**.

## 2026-09

- **Projects:** added a Week / Month zoom toggle to the Project Timeline
  view — Month zoom shows a full year at a glance instead of just 16 weeks.
- **Capacity:** fixed the editable allocation % input's "%" sign not
  matching the number's color.
- **Capacity:** added a By person / By project toggle with collapsible
  groups (+ "Collapse all") for boards with many people; added an
  Unallocated this week list, sorted by company; allocation % is now
  editable inline on the board.
- **Dashboard:** added a Sales Pipeline summary — deal counts and value
  per stage, plus a "Needs attention" list of high-priority open deals.
- **Sales pipeline:** a won lead's card now links its project name
  straight to the project's page.
- **Projects:** fixed adding a project cost from the project detail page
  silently failing and reloading the page instead of saving.
- **Sales pipeline:** added a "Completed" kanban stage; fixed commission
  figures not syncing when a project's cost lines change.
- **Projects:** fixed start date not saving (was silently failing on
  invalid dates sent to the database); save errors now show up in the
  project detail view instead of failing silently.

## 2026-08

- **People:** added pagination to the People list (5 / 10 / custom page
  size), moved the pagination bar above the table.
- **Skills:** added a Skills Guide page (linked via the **?** button on
  the master skill list) describing every skill in plain language;
  master skill list now grouped into collapsible categories matching
  the studio's skillset document.
- **Sales pipeline:** added drag-and-drop to the kanban board.
- **Skills:** added skill categories, a self-assessment form, and a
  skill rating guide.
- **Clients:** fixed client website links resolving relative to the app
  instead of the client's own site.
- **Leads:** WhatsApp group notification sent automatically when a new
  lead is created or a lead's pipeline status changes.
- **Guide:** login page now points to the production domain instead of
  the LAN IP; added a User Guide link to the app header documenting the
  Sales/Leads workflow.
- **People:** added software-skills tracking, editable lead amount, and
  field-level diffs on the audit log.

## 2026-07

- **Admin:** added the Audit Log — an immutable record of every
  create/update/delete across Leads, Projects, People, Users, Change
  Requests, and Accounting Documents. Defaults to the current year with
  a year picker for history.
- **Sales pipeline:** added an inline "Closed By" picker on every lead
  kanban card.
- **Onboarding:** welcome email now sent automatically when a new joiner
  is onboarded or a login is created for them.
- **Autocount:** document sync now limited to the current calendar year
  (was pulling all historical records); fixed sync silently skipping all
  records due to a response-shape mismatch.
- **Finance:** added Autocount reconciliation — compares Pop OS records
  against live Autocount and flags amount/status mismatches.
- **HR:** added person lifecycle tracking, committees, departments, and
  job titles.

## 2026-06

- **Access:** added STAFF role with a guided onboarding flow for staff
  without a linked People record; added a hard gate preventing projects
  from being marked DELIVERED with incomplete assets.
- **Projects:** added a Kanban view and the PPM (Priority/Phase/Margin)
  recommendation engine.
- **Sales Performance:** new module — commission tiers, quarterly sales
  targets per producer, per-person commission-rate overrides, attainment
  % and net-profit reporting.
- **Search:** added search and filter bars to Projects, People, Sales,
  and Capacity tabs.
- **People:** salary visibility restricted to ADMIN and FINANCE roles
  everywhere else in the app; added the `canSignOff` flag so sign-off
  authority can be granted per person instead of by role.
- **Assets:** added a Creative Director review flow — Approve/Reject
  directly from the sign-off queue.
- **Reports:** added CSV exports, payment-alert emails, and a project
  timeline (Gantt) view.
- **Change Requests:** new module for formal client scope-change
  tracking with budget impact and approval notes.
- **Access:** added PM and Team Lead roles; added the My Work personal
  dashboard (capacity, assigned assets, sign-off queue, payment alerts).
- **Finance:** redesigned the Finance Dashboard with pipeline bars and
  an SVG donut health chart.
- **Auth:** added JWT authentication, Autocount integration, and the
  Finance Dashboard.
- **Sales & Clients:** added the Sales Hub and Clients Hub — Accounts,
  Contacts, Leads, pipeline board, and Lead → Project conversion.
- **Foundation:** added Assets, the Production Engine, and the
  Financial Engine (man-day costing).

---

## Module build order (historical)

The order Pop OS was built in, and why — moved here from `CLAUDE.md` since
every item below is done; kept for context on how the system grew.

### Foundation
1. **People / ELC**
2. **Projects**
3. **Capacity**

### Intelligence layer
4. **Dashboard** — payment alerts section (AccountingDocuments due within
   10 days, with producer name to chase).
5. **PPM recommendation engine**
6. **Staffing recommendation engine**

### Production layer
7. **Assets**
8. **Production Engine / Lane Routing**

### Financial layer
9. **Financial Engine** — man-day costing. `GET /api/financial/overview`,
   `GET /api/financial/projects`, `GET /api/financial/dashboard`.
   Finance Dashboard: AR KPI cards, overdue invoices, due-soon panel,
   pipeline by stage, project health RAG, recent Autocount documents.

### Auth & access control
- **JWT auth** — login page at `/login.html`. 7 roles. Global guard.
  `POST /api/auth/login`, `GET /api/auth/me`.
- **Users module** — `GET/POST/PATCH/DELETE /api/users` (admin only).
  User manager modal in the header (admin).
- **Person ↔ User link** — lock icon on People tab lets admin create a
  login for a staff member.
- **canSignOff flag** — per-person sign-off authority (not role-based).
  Admin toggles on People tab. Affects sign-off queue visibility on My Work.
- **Salary visibility** — restricted to ADMIN + FINANCE. All other roles
  see `—` in salary column.

### Growth & client layer
10. **Sales & Growth Hub** — Accounts, Contacts, Leads. Pipeline board.
    Lead → Project conversion. `POST /api/leads/:id/convert`.
11. **Client Hub** — Account detail view with contacts, linked leads and
    projects.

### Accounting integration
- **Autocount Cloud** — push quotations from WON leads, invoices from
  projects. AccountingDocument model tracks all documents with due dates.
  Finance Dashboard shows AR position, overdue alerts, pipeline, health.

### Staffing suggestion engine
12. **Required Skills + Staff Suggestions** — producer tags `ProjectSkill` records
    (project ↔ skill join table). `GET /api/projects/:id/staff-suggestions` returns per-skill
    ranked candidates scored by skill rating (60%) + free capacity during project window (40%).
    UI: Required Skills chip-tag section + Suggested Staff ranked panel in project detail.
    Endpoints: `GET /api/projects/all-skills`, `GET/POST/DELETE /api/projects/:id/skills/:skillId`.

### Workflow & productivity
- **Change Requests** — per-project formal CRs with PENDING/APPROVED/REJECTED
  status, budget impact, and approval notes. `GET/POST/PATCH/DELETE /api/change-requests`.
- **My Work tab** — personal dashboard for all roles — capacity, assigned
  assets, sign-off queue (canSignOff), payment alerts. `GET /api/me/dashboard`.
  CD approve/reject from sign-off queue with rejection note back to REVISION.
- **Email payment alerts** — Nodemailer digest via SMTP. Configure
  `SMTP_*` vars in `.env`. `POST /api/notifications/payment-alerts`. Trigger from
  Financial tab ("✉ Send alert email").
- **CSV exports** — Projects, capacity, AR. `GET /api/reports/*`.
- **Project Gantt timeline** — 16-week SVG view in project detail.
- **Kanban views** — Assets kanban board in assets.js.

### Sales performance & commissions
- **Sales Performance tab** — commission report — attainment %, net profit,
  commission per producer. `GET /api/sales-performance`.
- **CommissionTier** — global rate schedule (50/75/100/150%). Admin-editable.
- **SalesTarget** — quarterly targets per producer.
- **ProjectCost** — per-project cost lines (WARM_POOL / SUPPLIER / ADDITIONAL).
- **PersonTierRate** — per-person commission rate override per tier.
- **STAFF role + onboarding flow** — STAFF has My Work access; onboarding
  flow guides new staff without a linked Person record.

### Go-live & data ops
- **Production reset script** — `prisma/reset-for-production.js`. Deletes all
  transactional data in FK order, keeps Skills/Departments/JobTitles/CommissionTiers,
  creates admin account. Run once before go-live.
- **Airtable import** — `prisma/import-airtable.js`. Imports Accounts, Contacts,
  Leads from two Airtable bases (2024-2025 and 2026). Requires `AIRTABLE_PAT` env var.
- **Welcome email** — sent automatically on new joiner onboard (`POST /api/people/onboard`)
  and when admin creates a login (`POST /api/users`). HTML email with per-company
  branding: LPS=amber "Lorrypop Studio", PXL=teal "Popxical Lab". Uses `APP_URL`
  env var for the login link. Fire-and-forget — never blocks the API response.
- **Autocount reconciliation** — `GET /api/autocount/reconcile`. Compares every
  Pop OS AccountingDocument against live Autocount. Returns OK / AMOUNT_MISMATCH /
  STATUS_MISMATCH / BOTH_MISMATCH / NOT_FOUND per document. Triggered from Financial
  tab (⚖ Reconcile button).
- **Autocount sync year filter** — `syncDocuments()` only pulls current calendar
  year documents. Prevents historical data bloat.

### Enterprise readiness
- **Audit Log** — `src/audit/`. Immutable event log for all key mutations.
  Admin tab (`public/js/admin.js`) with filters: year, resource, action, actor,
  date range, search. Expandable detail viewer shows full record state + field diff.
  Year picker defaults to current year; "All years" available for history.
