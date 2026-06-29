/*
  Warnings:

  - You are about to drop the column `warmPool` on the `Person` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('ACTIVE', 'WARM_POOL', 'RESIGNED', 'TERMINATED');

-- AlterTable
ALTER TABLE "Person" DROP COLUMN "warmPool",
ADD COLUMN     "status" "PersonStatus" NOT NULL DEFAULT 'ACTIVE';
