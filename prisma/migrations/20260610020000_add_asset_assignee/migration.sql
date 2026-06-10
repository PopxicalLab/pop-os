-- AlterTable: add assignedToId to Asset so assets can be assigned to a Person.
-- Used by the My Work personal dashboard to show each person their open tasks.
ALTER TABLE "Asset" ADD COLUMN "assignedToId" TEXT;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_assignedToId_fkey"
  FOREIGN KEY ("assignedToId") REFERENCES "Person"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
