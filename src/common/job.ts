import { Prisma, PrismaClient } from '@prisma/client';

// ── The "Job" root (Sept 2026 restructure) ──────────────────────────
// A Job is a Lead that owns a Project. The Lead (job) holds the money —
// value, margin target, client tier, costs, quotations/invoices — AND the
// PPM assessment (quadrant, complexity, duration, Drain approvals), which is
// done before quoting. The Project holds production info only, plus a mirror
// of the quadrant for the production lanes. Every Project has exactly one job.
//
// Project still has its old money / PPM columns. They are no longer the
// source of truth: read them from the job via the helpers here. The step-4
// cleanup migration drops them (except Project.quadrant — the lane mirror).

// Either the root client or a transaction client (`tx` inside $transaction).
type Db = PrismaClient | Prisma.TransactionClient;

// Add this to a Project `include`/`select` to fetch its job's money + PPM fields.
export const JOB_FIELDS = {
  lead: {
    select: {
      id: true, estimatedValue: true, marginTarget: true, clientTier: true,
      complexityScore: true, estimatedDuration: true,
      drainApprovedByExec: true, drainApprovedByProducer: true,
    },
  },
} as const;

type JobFields = {
  id: string;
  estimatedValue: number | null;
  marginTarget: number | null;
  clientTier: string | null;
  complexityScore: number | null;
  estimatedDuration: number | null;
  drainApprovedByExec: boolean;
  drainApprovedByProducer: boolean;
} | null;

// Replace a project's (stale) money + PPM fields with its job's values, and
// add `jobId`. For SERVER-SIDE money work only (PPM scoring, Financial,
// reports) — the projects API itself never returns these (see
// ProjectsService: projects are production-only, readable by STAFF).
// (quadrant isn't overlaid: Project.quadrant is kept in sync with the job.)
export function withJobFields<T extends { lead?: JobFields }>(project: T) {
  const { lead, ...rest } = project;
  return {
    ...rest,
    jobId:                   lead?.id ?? null,
    estimatedValue:          lead?.estimatedValue    ?? null,
    marginTarget:            lead?.marginTarget      ?? null,
    clientTier:              lead?.clientTier        ?? null,
    complexityScore:         lead?.complexityScore   ?? null,
    estimatedDuration:       lead?.estimatedDuration ?? null,
    drainApprovedByExec:     lead?.drainApprovedByExec     ?? false,
    drainApprovedByProducer: lead?.drainApprovedByProducer ?? false,
  };
}
// Jobs created for a project that had no sale behind it (made on the
// Projects tab, or back-filled by the migration) use this id pattern.
// That's how we tell them apart from real sales leads — e.g. deleting the
// project also deletes an auto job, but never a real lead's sales history.
export const autoJobId = (projectId: string) => `job_${projectId}`;
export const isAutoJob = (leadId: string) => leadId.startsWith('job_');

// Return the id of the project's job, creating an auto job if it's missing.
// Safety net only — the migration gave every existing project a job, and
// ProjectsService.create() makes one for every new project.
export async function ensureJobForProject(db: Db, projectId: string): Promise<string> {
  const existing = await db.lead.findUnique({ where: { projectId }, select: { id: true } });
  if (existing) return existing.id;

  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const job = await db.lead.create({
    data: {
      id:        autoJobId(project.id),
      name:      project.name,
      accountId: project.accountId,
      company:   project.company,
      // closedById / wonAt stay empty → never counted in commission or targets.
      status:    project.status === 'DELIVERED' ? 'COMPLETED'
               : project.status === 'CANCELLED' ? 'LOST'
               : 'WON',
      notes:     'Auto-created for a project with no sale logged behind it.',
      projectId: project.id,
      quadrant:  project.quadrant,
    },
    select: { id: true },
  });
  return job.id;
}
