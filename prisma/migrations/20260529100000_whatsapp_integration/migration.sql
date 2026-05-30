-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'TEMPLATE', 'INTERACTIVE', 'LOCATION', 'CONTACTS', 'REACTION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "WhatsAppTemplateStatus" AS ENUM ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WebhookProvider" AS ENUM ('GMAIL', 'WHATSAPP', 'STRIPE', 'CLERK');

-- CreateEnum
CREATE TYPE "WebhookProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "OutboundJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboundJobType" AS ENUM ('TEXT', 'TEMPLATE', 'MEDIA', 'INTERACTIVE');

-- AlterTable: connected_accounts
ALTER TABLE "connected_accounts" ADD COLUMN "whatsappBusinessAccountId" TEXT;
ALTER TABLE "connected_accounts" ADD COLUMN "metaAppId" TEXT;
ALTER TABLE "connected_accounts" ADD COLUMN "encryptedWebhookVerifyToken" TEXT;

-- AlterTable: conversations
ALTER TABLE "conversations" ADD COLUMN "participantPhone" TEXT;
ALTER TABLE "conversations" ADD COLUMN "participantName" TEXT;

-- AlterTable: messages
ALTER TABLE "messages" ADD COLUMN "whatsappMessageType" "WhatsAppMessageType";
ALTER TABLE "messages" ADD COLUMN "deliveryStatus" "MessageDeliveryStatus";
ALTER TABLE "messages" ADD COLUMN "replyToExternalId" TEXT;
ALTER TABLE "messages" ADD COLUMN "rawPayload" JSONB;

-- AlterTable: message_attachments
ALTER TABLE "message_attachments" ADD COLUMN "whatsappMediaUrl" TEXT;

-- CreateTable
CREATE TABLE "whatsapp_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" TEXT,
    "status" "WhatsAppTemplateStatus" NOT NULL DEFAULT 'UNKNOWN',
    "components" JSONB,
    "externalId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "connectedAccountId" TEXT,
    "provider" "WebhookProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "signatureValid" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_outbound_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "type" "OutboundJobType" NOT NULL,
    "status" "OutboundJobStatus" NOT NULL DEFAULT 'PENDING',
    "recipientPhone" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "externalMessageId" TEXT,
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_outbound_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_templates_organizationId_status_idx" ON "whatsapp_templates"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_templates_connectedAccountId_name_language_key" ON "whatsapp_templates"("connectedAccountId", "name", "language");

-- CreateIndex
CREATE INDEX "webhook_logs_status_nextRetryAt_idx" ON "webhook_logs"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "webhook_logs_connectedAccountId_createdAt_idx" ON "webhook_logs"("connectedAccountId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_logs_provider_idempotencyKey_key" ON "webhook_logs"("provider", "idempotencyKey");

-- CreateIndex
CREATE INDEX "whatsapp_outbound_jobs_status_nextRetryAt_idx" ON "whatsapp_outbound_jobs"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "whatsapp_outbound_jobs_connectedAccountId_createdAt_idx" ON "whatsapp_outbound_jobs"("connectedAccountId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_templates" ADD CONSTRAINT "whatsapp_templates_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_outbound_jobs" ADD CONSTRAINT "whatsapp_outbound_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_outbound_jobs" ADD CONSTRAINT "whatsapp_outbound_jobs_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
