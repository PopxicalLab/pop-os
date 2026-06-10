-- Add CRStatus enum and ChangeRequest table.
-- CRs track formal client scope-change requests logged against a project.
-- No transaction pragma needed: CREATE TYPE works fine in a transaction.

CREATE TYPE "CRStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "ChangeRequest" (
    "id"           TEXT              NOT NULL,
    "title"        TEXT              NOT NULL,
    "description"  TEXT              NOT NULL,
    "budgetImpact" DOUBLE PRECISION  NOT NULL DEFAULT 0,
    "status"       "CRStatus"        NOT NULL DEFAULT 'PENDING',
    "requestedBy"  TEXT,
    "note"         TEXT,
    "projectId"    TEXT              NOT NULL,
    "createdAt"    TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
