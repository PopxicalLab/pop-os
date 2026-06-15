-- Add startDate to Project for timeline / Gantt view.
-- Nullable so existing projects are unaffected.
ALTER TABLE "Project" ADD COLUMN "startDate" TIMESTAMP(3);
