/*
  Warnings:

  - Made the column `company` on table `Project` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill: any project with no company set becomes GROUP (cross-company) —
-- the neutral default for work that was never assigned to one side. As of
-- this migration there is exactly one such row ("Pop Group Annual Reel
-- 2025"), whose name makes GROUP the obvious call.
UPDATE "Project" SET "company" = 'GROUP' WHERE "company" IS NULL;

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "company" SET NOT NULL;
