import { Prisma, PrismaClient } from '@prisma/client';

// ── The "Job" root (Sept 2026 restructure) ──────────────────────────
// A Job is a Lead that owns a Project. The Lead (job) holds the money —
// value, margin target, client tier, costs, quotations/invoices — and the
// Project holds production info only. Every Project has exactly one job.
//
// During the move, Project still has its old money columns. They are no
// longer the source of truth: read money from the job via the helpers here.
// The step-4 cleanup migration drops the Project columns.

// Either the root client or a transaction client (`tx` inside $transaction).
type Db = PrismaClient | Prisma.TransactionClient;

// Add this to a Project `include`/`select` to fetch its job's money fields.
export const JOB_MONEY = {
  lead: { select: { id: true, estimatedValue: true, marginTarget: true, clientTier: true } },
} as const;

type JobMoney = {
  id: string;
  estimatedValue: number | null;
  marginTarget: number | null;
  clientTier: string | null;
} | null;

// Replace a project's (stale) money fields with its job's values, and add
// `jobId` so the UI can link across. Keeps the response shape the frontend
// already reads, so screens keep working until they're moved to the job.
export function withJobMoney<T extends { lead?: JobMoney }>(project: T) {
  const { lead, ...rest } = project;
  return {
    ...rest,
    jobId:          lead?.id ?? null,
    estimatedValue: lead?.estimatedValue ?? null,
    marginTarget:   lead?.marginTarget   ?? null,
    clientTier:     lead?.clientTier     ?? null,
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
    },
    select: { id: true },
  });
  return job.id;
}
