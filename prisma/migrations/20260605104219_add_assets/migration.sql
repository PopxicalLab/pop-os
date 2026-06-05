-- CreateEnum
CREATE TYPE "AssetStage" AS ENUM ('BRIEF', 'WIP', 'INTERNAL_REVIEW', 'REVISION', 'FINAL_DELIVERY');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectId" TEXT NOT NULL,
    "stage" "AssetStage" NOT NULL DEFAULT 'BRIEF',
    "cdSignedOff" BOOLEAN NOT NULL DEFAULT false,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
