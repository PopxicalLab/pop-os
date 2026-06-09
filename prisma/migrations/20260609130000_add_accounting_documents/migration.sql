-- Replace simple string refs with a proper AccountingDocument model.
ALTER TABLE "Lead"    DROP COLUMN IF EXISTS "autocountQuotationRef";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "autocountInvoiceRef";

CREATE TYPE "DocType"   AS ENUM ('QUOTATION', 'SALES_INVOICE', 'PURCHASE_INVOICE');
CREATE TYPE "DocStatus" AS ENUM ('ACTIVE', 'VOID', 'PAID');

CREATE TABLE "AccountingDocument" (
  "id"         TEXT NOT NULL,
  "projectId"  TEXT,
  "leadId"     TEXT,
  "docType"    "DocType"   NOT NULL,
  "docNo"      TEXT        NOT NULL,
  "docDate"    TIMESTAMP(3) NOT NULL,
  "dueDate"    TIMESTAMP(3),
  "amount"     DOUBLE PRECISION,
  "debtorCode" TEXT,
  "debtorName" TEXT,
  "creditTerm" TEXT,
  "notes"      TEXT,
  "status"     "DocStatus" NOT NULL DEFAULT 'ACTIVE',
  "notifiedAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingDocument_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
