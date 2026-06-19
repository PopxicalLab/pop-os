/*
  Warnings:

  - You are about to drop the column `commissionRateOverride` on the `Person` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Person" DROP COLUMN "commissionRateOverride";

-- CreateTable
CREATE TABLE "PersonTierRate" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonTierRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonTierRate_personId_tierId_key" ON "PersonTierRate"("personId", "tierId");

-- AddForeignKey
ALTER TABLE "PersonTierRate" ADD CONSTRAINT "PersonTierRate_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTierRate" ADD CONSTRAINT "PersonTierRate_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "CommissionTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
