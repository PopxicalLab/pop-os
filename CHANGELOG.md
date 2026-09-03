# Changelog

All notable changes to Pop OS are recorded here, newest first. This is a
user-facing summary — internal refactors, dependency bumps, and doc-only
commits are omitted. The in-app version of this page is linked from the
user menu (top right, after login) → **What's new**.

## 2026-09

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
