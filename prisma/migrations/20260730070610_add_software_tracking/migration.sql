-- CreateTable
CREATE TABLE "Software" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Software_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonSoftware" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "softwareId" TEXT NOT NULL,

    CONSTRAINT "PersonSoftware_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Software_name_key" ON "Software"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PersonSoftware_personId_softwareId_key" ON "PersonSoftware"("personId", "softwareId");

-- AddForeignKey
ALTER TABLE "PersonSoftware" ADD CONSTRAINT "PersonSoftware_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSoftware" ADD CONSTRAINT "PersonSoftware_softwareId_fkey" FOREIGN KEY ("softwareId") REFERENCES "Software"("id") ON DELETE CASCADE ON UPDATE CASCADE;
