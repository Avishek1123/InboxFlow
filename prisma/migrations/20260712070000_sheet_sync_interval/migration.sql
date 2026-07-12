-- AlterTable
ALTER TABLE "sheet_exports" ADD COLUMN IF NOT EXISTS "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 1;
