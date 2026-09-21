-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('CAPACITY_WEEKLY');

-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('CHANNEL', 'USER');

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "company" "Company",
    "dayOfWeek" INTEGER,
    "timeOfDay" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTarget" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "type" "NotificationTargetType" NOT NULL,
    "channel" TEXT,
    "userId" TEXT,
    "mattermostUsername" TEXT,

    CONSTRAINT "NotificationTarget_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NotificationTarget" ADD CONSTRAINT "NotificationTarget_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "NotificationRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
