-- AlterTable
ALTER TABLE "AccountingDocument" ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "ProjectCost" ADD COLUMN     "documentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCost_documentId_key" ON "ProjectCost"("documentId");

-- AddForeignKey
ALTER TABLE "ProjectCost" ADD CONSTRAINT "ProjectCost_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AccountingDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

