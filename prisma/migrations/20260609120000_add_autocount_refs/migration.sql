-- Add Autocount integration reference fields.
-- Account gets a debtor code link; Lead stores the quotation doc number;
-- Project stores the invoice doc number. All nullable — existing rows unaffected.
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "autocountDebtorCode" TEXT;
ALTER TABLE "Lead"    ADD COLUMN IF NOT EXISTS "autocountQuotationRef" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "autocountInvoiceRef" TEXT;
