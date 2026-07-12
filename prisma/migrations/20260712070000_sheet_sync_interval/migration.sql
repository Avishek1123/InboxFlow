-- CreateTable (was never in earlier migrations; only added via local db push)
CREATE TABLE IF NOT EXISTS "sheet_exports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "extractionTableId" TEXT NOT NULL,
    "label" TEXT,
    "sheetTitle" TEXT NOT NULL DEFAULT 'InboxFlow Export',
    "spreadsheetId" TEXT,
    "spreadsheetUrl" TEXT,
    "appsScriptId" TEXT,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 1,
    "apiKeyHash" TEXT NOT NULL,
    "apiKeyPrefix" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastFetchedAt" TIMESTAMP(3),

    CONSTRAINT "sheet_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sheet_exports_organizationId_extractionTableId_key"
  ON "sheet_exports"("organizationId", "extractionTableId");

CREATE INDEX IF NOT EXISTS "sheet_exports_apiKeyHash_idx"
  ON "sheet_exports"("apiKeyHash");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "sheet_exports"
    ADD CONSTRAINT "sheet_exports_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sheet_exports"
    ADD CONSTRAINT "sheet_exports_extractionTableId_fkey"
    FOREIGN KEY ("extractionTableId") REFERENCES "extraction_tables"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- In case table already existed without this column (local db push)
ALTER TABLE "sheet_exports"
  ADD COLUMN IF NOT EXISTS "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 1;
