-- Sales Performance: wonAt on Lead, SalesTarget, CommissionTier, ProjectCost

-- Track when a lead was won (for quarterly bucketing in commission calculations).
-- Backfill existing WON leads with updatedAt as best approximation.
ALTER TABLE "Lead" ADD COLUMN "wonAt" TIMESTAMP(3);
UPDATE "Lead" SET "wonAt" = "updatedAt" WHERE status = 'WON';

-- Cost type enum for project cost entries.
CREATE TYPE "CostType" AS ENUM ('WARM_POOL', 'SUPPLIER', 'ADDITIONAL');

-- Quarterly sales target per producer.
CREATE TABLE "SalesTarget" (
  "id"           TEXT NOT NULL,
  "personId"     TEXT NOT NULL,
  "year"         INTEGER NOT NULL,
  "quarter"      INTEGER NOT NULL,
  "targetAmount" DOUBLE PRECISION NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "SalesTarget_personId_year_quarter_key" ON "SalesTarget"("personId", "year", "quarter");

-- Admin-configurable commission tiers.
CREATE TABLE "CommissionTier" (
  "id"        TEXT NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "rate"      DOUBLE PRECISION NOT NULL,
  "label"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionTier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommissionTier_threshold_key" ON "CommissionTier"("threshold");

-- Project-level costs deducted before commission is calculated.
CREATE TABLE "ProjectCost" (
  "id"          TEXT NOT NULL,
  "projectId"   TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "costType"    "CostType" NOT NULL DEFAULT 'ADDITIONAL',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProjectCost_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the four default commission tiers.
INSERT INTO "CommissionTier" ("id", "threshold", "rate", "label", "createdAt", "updatedAt") VALUES
  ('ct_tier_50',  0.50, 0.0035, 'Hit 50%',  NOW(), NOW()),
  ('ct_tier_75',  0.75, 0.0100, 'Hit 75%',  NOW(), NOW()),
  ('ct_tier_100', 1.00, 0.0250, 'Hit 100%', NOW(), NOW()),
  ('ct_tier_150', 1.50, 0.0400, 'Hit 150%', NOW(), NOW());
