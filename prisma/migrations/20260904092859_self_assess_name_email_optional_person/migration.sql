-- DropForeignKey
ALTER TABLE "SkillSelfAssessment" DROP CONSTRAINT "SkillSelfAssessment_personId_fkey";

-- AlterTable
ALTER TABLE "SkillSelfAssessment" ADD COLUMN     "submittedEmail" TEXT,
ADD COLUMN     "submittedName" TEXT,
ALTER COLUMN "personId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SkillSelfAssessment" ADD CONSTRAINT "SkillSelfAssessment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
