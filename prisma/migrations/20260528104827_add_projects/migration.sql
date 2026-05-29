-- CreateEnum
CREATE TYPE "ProjectQuadrant" AS ENUM ('GOLD', 'STRATEGIC_BET', 'OPERATIONAL_FILLER', 'DRAIN');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('P1', 'P2', 'P3');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('BRIEF', 'IN_PROGRESS', 'INTERNAL_REVIEW', 'DELIVERED', 'ON_HOLD', 'CANCELLED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "quadrant" "ProjectQuadrant" NOT NULL,
    "priority" "ProjectPriority" NOT NULL DEFAULT 'P2',
    "status" "ProjectStatus" NOT NULL DEFAULT 'BRIEF',
    "deadline" TIMESTAMP(3),
    "producerId" TEXT,
    "pmId" TEXT,
    "drainApprovedByExec" BOOLEAN NOT NULL DEFAULT false,
    "drainApprovedByProducer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_pmId_fkey" FOREIGN KEY ("pmId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
