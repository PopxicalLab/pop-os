-- Add optional commission rate override to Person.
-- When set, this bypasses the global tier table for that person.
-- e.g. 0.025 = 2.5% flat regardless of attainment.
ALTER TABLE "Person" ADD COLUMN "commissionRateOverride" DOUBLE PRECISION;
