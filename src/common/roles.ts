import { CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

// ── Who can see money ────────────────────────────────────────────────
// Pop OS splits people into two audiences (Sept 2026):
//   • Job roles — see the whole deal: value, margin, costs, invoices, PPM.
//   • Project-only roles (TEAM_LEAD, STAFF) — see production only: dates,
//     team, priority, quadrant, skills, capacity. Never money.
// Hiding a tab isn't enough — the API must refuse too, or the data is one
// URL away. Every money endpoint calls requireRole() with one of these.
// Keep in sync with TAB_ACCESS in public/js/shared.js.

export const JOB_ROLES     = ['ADMIN', 'PRODUCER', 'PM', 'FINANCE', 'SALES'];
export const FINANCE_ROLES = ['ADMIN', 'FINANCE', 'PM'];   // Financial tab (PM gets its own view)
export const ADMIN_ONLY    = ['ADMIN'];                    // Sales Performance, commission, targets

export function canSeeMoney(role?: string | null): boolean {
  return JOB_ROLES.includes(role ?? '');
}

// Throws 403 unless the logged-in user's role is in `roles`.
// `req.user` is set by the global JwtAuthGuard.
export function requireRole(req: any, roles: string[]): void {
  if (!roles.includes(req.user?.role)) {
    throw new ForbiddenException('Not available for your role');
  }
}

// Locks a WHOLE controller to some roles in one line, so no route can be
// forgotten:   @UseGuards(onlyRoles(JOB_ROLES))   above the @Controller class.
// Runs after the global JwtAuthGuard, so req.user is already set.
// (Use requireRole() instead when only some routes of a controller need it.)
export function onlyRoles(roles: string[]): CanActivate {
  return {
    canActivate(ctx: ExecutionContext) {
      requireRole(ctx.switchToHttp().getRequest(), roles);
      return true;
    },
  };
}

// Old money / PPM columns still physically on Project (until the step-4
// cleanup drops them). They're stale — the job holds the real values — and
// must never reach a project-only user, so strip them from any full
// Project row before it leaves the API.
const PROJECT_JOB_COLUMNS = [
  'estimatedValue', 'marginTarget', 'clientTier',
  'complexityScore', 'estimatedDuration',
] as const;

export function stripJobColumns<T extends Record<string, any>>(project: T): Omit<T, typeof PROJECT_JOB_COLUMNS[number]> {
  const out: Record<string, any> = { ...project };
  for (const c of PROJECT_JOB_COLUMNS) delete out[c];
  return out as any;
}
