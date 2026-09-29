-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ChangeRequest" DROP CONSTRAINT "ChangeRequest_projectId_fkey";

-- AlterTable
ALTER TABLE "Person" DROP COLUMN "canSignOff";

-- DropTable
DROP TABLE "Asset";

-- DropTable
DROP TABLE "ChangeRequest";

-- DropEnum
DROP TYPE "CRStatus";

-- DropEnum
DROP TYPE "AssetStage";

