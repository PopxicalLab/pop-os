/*
  Warnings:

  - You are about to drop the column `skillTags` on the `Person` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RatingSource" AS ENUM ('INTERVIEW', 'PROJECT_COMPLETION', 'MANUAL_ADJUSTMENT');

-- AlterTable
ALTER TABLE "Person" DROP COLUMN "skillTags";

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonSkill" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillRatingChange" (
    "id" TEXT NOT NULL,
    "personSkillId" TEXT NOT NULL,
    "oldRating" INTEGER,
    "newRating" INTEGER NOT NULL,
    "source" "RatingSource" NOT NULL,
    "changedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillRatingChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Skill_name_key" ON "Skill"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PersonSkill_personId_skillId_key" ON "PersonSkill"("personId", "skillId");

-- AddForeignKey
ALTER TABLE "PersonSkill" ADD CONSTRAINT "PersonSkill_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSkill" ADD CONSTRAINT "PersonSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillRatingChange" ADD CONSTRAINT "SkillRatingChange_personSkillId_fkey" FOREIGN KEY ("personSkillId") REFERENCES "PersonSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
