-- ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL.
-- The directive below tells Prisma to run this migration without wrapping it.
-- prisma-migrate-no-transaction

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PM';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TEAM_LEAD';
