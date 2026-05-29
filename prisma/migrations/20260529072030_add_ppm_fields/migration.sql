-- CreateEnum
CREATE TYPE "ClientTier" AS ENUM ('NEW', 'RETURNING', 'KEY_ACCOUNT');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "clientTier" "ClientTier",
ADD COLUMN     "complexityScore" INTEGER,
ADD COLUMN     "estimatedDuration" INTEGER,
ADD COLUMN     "estimatedValue" DOUBLE PRECISION,
ADD COLUMN     "marginTarget" DOUBLE PRECISION;
