-- CreateEnum
CREATE TYPE "AiTaskType" AS ENUM ('SUMMARIZE_EMAIL', 'SUMMARIZE_WHATSAPP', 'EXTRACT_LEAD', 'EXTRACT_ORDER', 'EXTRACT_INVOICE', 'SENTIMENT', 'INTENT', 'AUTO_REPLY', 'FULL_ANALYSIS');

-- CreateEnum
CREATE TYPE "AiProviderName" AS ENUM ('GROQ', 'GEMINI', 'OPENROUTER');

-- CreateEnum
CREATE TYPE "AiExtractionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CACHED');

-- CreateTable
CREATE TABLE "ai_extractions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "messageId" TEXT,
    "taskType" "AiTaskType" NOT NULL,
    "channel" "MessageChannel",
    "status" "AiExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "AiProviderName",
    "model" TEXT,
    "latencyMs" INTEGER,
    "inputChars" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "contentHash" TEXT,
    "result" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_extractions_organizationId_taskType_createdAt_idx" ON "ai_extractions"("organizationId", "taskType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_extractions_contentHash_idx" ON "ai_extractions"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "ai_extractions_organizationId_messageId_taskType_contentHash_key" ON "ai_extractions"("organizationId", "messageId", "taskType", "contentHash");

-- AddForeignKey
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
