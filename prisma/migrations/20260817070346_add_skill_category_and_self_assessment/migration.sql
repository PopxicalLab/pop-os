-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "SkillSelfAssessment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillSelfAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SelfAssessmentRating" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelfAssessmentRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SelfAssessmentRating_assessmentId_skillId_key" ON "SelfAssessmentRating"("assessmentId", "skillId");

-- AddForeignKey
ALTER TABLE "SkillSelfAssessment" ADD CONSTRAINT "SkillSelfAssessment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfAssessmentRating" ADD CONSTRAINT "SelfAssessmentRating_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "SkillSelfAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SelfAssessmentRating" ADD CONSTRAINT "SelfAssessmentRating_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
