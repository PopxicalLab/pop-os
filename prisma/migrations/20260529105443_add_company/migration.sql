-- CreateEnum
CREATE TYPE "Company" AS ENUM ('LPS', 'PXL');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "company" "Company";

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "company" "Company";
