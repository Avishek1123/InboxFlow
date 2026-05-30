-- CreateTable
CREATE TABLE "extraction_tables" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "columns" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extraction_table_rows" (
    "id" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT,
    "values" JSONB NOT NULL,
    "sourceSubject" TEXT,
    "sourceFrom" TEXT,
    "sourceSnippet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extraction_table_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "extraction_tables_organizationId_idx" ON "extraction_tables"("organizationId");

-- CreateIndex
CREATE INDEX "extraction_table_rows_tableId_createdAt_idx" ON "extraction_table_rows"("tableId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "extraction_table_rows_tableId_messageId_key" ON "extraction_table_rows"("tableId", "messageId");

-- AddForeignKey
ALTER TABLE "extraction_tables" ADD CONSTRAINT "extraction_tables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_table_rows" ADD CONSTRAINT "extraction_table_rows_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "extraction_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_table_rows" ADD CONSTRAINT "extraction_table_rows_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extraction_table_rows" ADD CONSTRAINT "extraction_table_rows_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
