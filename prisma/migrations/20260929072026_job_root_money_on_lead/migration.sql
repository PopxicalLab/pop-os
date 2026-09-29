-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "clientTier" "ClientTier",
ADD COLUMN     "marginTarget" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ProjectCost" ADD COLUMN     "leadId" TEXT;

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ════════════════════════════════════════════════════════════════
-- DATA BACKFILL — make every Project hang off a Job (Lead), and copy
-- money info from the Project onto that Job. Nothing is deleted here;
-- the old Project columns stay until the step-4 cleanup migration.
-- ════════════════════════════════════════════════════════════════

-- 1. Create a Job for every Project that has no Lead yet (projects
--    created directly on the Projects tab, or imported). The id is
--    'job_' + project id: unique, and easy to recognise later.
--    closedById and wonAt stay NULL, so these never count towards
--    commission or sales targets (both filter on closedById NOT NULL).
--    Status mirrors the project: delivered → COMPLETED, cancelled → LOST,
--    anything else → WON.
INSERT INTO "Lead" ("id", "name", "accountId", "status", "priority", "estimatedValue",
                    "invoicedPct", "paidPct", "completed", "notes", "projectId", "company",
                    "marginTarget", "clientTier", "createdAt", "updatedAt")
SELECT 'job_' || p."id",
       p."name",
       p."accountId",
       (CASE p."status"
          WHEN 'DELIVERED' THEN 'COMPLETED'
          WHEN 'CANCELLED' THEN 'LOST'
          ELSE 'WON' END)::"LeadStatus",
       'MEDIUM'::"LeadPriority",
       p."estimatedValue",
       0, 0, false,
       'Auto-created (Sept 2026 job restructure) so this project has a job record for its money. No sale was logged for it.',
       p."id",
       p."company",
       p."marginTarget",
       p."clientTier",
       p."createdAt",
       NOW()
FROM "Project" p
WHERE NOT EXISTS (SELECT 1 FROM "Lead" l WHERE l."projectId" = p."id");

-- 2. For Jobs that already existed (real won leads), fill in money fields
--    from the Project where the Lead has none. The Lead's own value wins
--    if both are set — it's the figure Sales agreed.
UPDATE "Lead" l
SET "estimatedValue" = COALESCE(l."estimatedValue", p."estimatedValue"),
    "marginTarget"   = COALESCE(l."marginTarget",   p."marginTarget"),
    "clientTier"     = COALESCE(l."clientTier",     p."clientTier"),
    "accountId"      = COALESCE(l."accountId",      p."accountId")
FROM "Project" p
WHERE l."projectId" = p."id";

-- 3. Point every cost at its project's Job.
UPDATE "ProjectCost" c
SET "leadId" = l."id"
FROM "Lead" l
WHERE l."projectId" = c."projectId";

-- 4. Point every Autocount document (invoices were project-only) at the Job.
UPDATE "AccountingDocument" d
SET "leadId" = l."id"
FROM "Lead" l
WHERE d."leadId" IS NULL
  AND d."projectId" IS NOT NULL
  AND l."projectId" = d."projectId";
