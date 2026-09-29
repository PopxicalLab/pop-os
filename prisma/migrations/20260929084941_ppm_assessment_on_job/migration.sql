-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "complexityScore" INTEGER,
ADD COLUMN     "drainApprovedByExec" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "drainApprovedByProducer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "estimatedDuration" INTEGER,
ADD COLUMN     "quadrant" "ProjectQuadrant";

-- ════════════════════════════════════════════════════════════════
-- DATA BACKFILL — copy each project's PPM assessment onto its job.
-- Every project already has a job (20260929072026_job_root_money_on_lead).
-- Leads without a project stay NULL = "not assessed yet".
-- Project columns are kept (quadrant stays as the production-lane mirror;
-- the others are dropped in the step-4 cleanup).
-- ════════════════════════════════════════════════════════════════
UPDATE "Lead" l
SET "quadrant"                = p."quadrant",
    "complexityScore"         = p."complexityScore",
    "estimatedDuration"       = p."estimatedDuration",
    "drainApprovedByExec"     = p."drainApprovedByExec",
    "drainApprovedByProducer" = p."drainApprovedByProducer"
FROM "Project" p
WHERE l."projectId" = p."id";
