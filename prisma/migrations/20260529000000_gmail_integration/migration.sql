-- CreateEnum
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "AccountProvider" AS ENUM ('GMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "ConnectedAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISCONNECTED', 'ERROR', 'TOKEN_EXPIRED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IDLE', 'SYNCING', 'ERROR');

-- CreateEnum
CREATE TYPE "SyncRunType" AS ENUM ('FULL', 'INCREMENTAL');

-- CreateEnum
CREATE TYPE "SyncRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('GMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "AttachmentStorageStatus" AS ENUM ('PENDING', 'STORED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connected_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AccountProvider" NOT NULL,
    "status" "ConnectedAccountStatus" NOT NULL DEFAULT 'PENDING',
    "accountEmail" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gmailHistoryId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'IDLE',
    "syncError" TEXT,
    "syncLockedAt" TIMESTAMP(3),
    "syncLockId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connected_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "externalThreadId" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "participantEmails" JSONB NOT NULL DEFAULT '[]',
    "lastMessageAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL DEFAULT 'INBOUND',
    "externalId" TEXT NOT NULL,
    "externalThreadId" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddresses" JSONB NOT NULL DEFAULT '[]',
    "ccAddresses" JSONB NOT NULL DEFAULT '[]',
    "bccAddresses" JSONB NOT NULL DEFAULT '[]',
    "subject" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "labels" JSONB NOT NULL DEFAULT '[]',
    "contentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageStatus" "AttachmentStorageStatus" NOT NULL DEFAULT 'PENDING',
    "storageKey" TEXT,
    "storageUrl" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_sync_runs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "connectedAccountId" TEXT NOT NULL,
    "type" "SyncRunType" NOT NULL,
    "status" "SyncRunStatus" NOT NULL DEFAULT 'PENDING',
    "messagesFetched" INTEGER NOT NULL DEFAULT 0,
    "messagesCreated" INTEGER NOT NULL DEFAULT 0,
    "messagesSkipped" INTEGER NOT NULL DEFAULT 0,
    "attachmentsStored" INTEGER NOT NULL DEFAULT 0,
    "attachmentsFailed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "gmail_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkUserId_key" ON "users"("clerkUserId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organization_members_userId_idx" ON "organization_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "connected_accounts_organizationId_provider_status_idx" ON "connected_accounts"("organizationId", "provider", "status");

-- CreateIndex
CREATE INDEX "connected_accounts_syncStatus_lastSyncedAt_idx" ON "connected_accounts"("syncStatus", "lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "connected_accounts_organizationId_provider_accountEmail_key" ON "connected_accounts"("organizationId", "provider", "accountEmail");

-- CreateIndex
CREATE INDEX "conversations_organizationId_channel_lastMessageAt_idx" ON "conversations"("organizationId", "channel", "lastMessageAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_connectedAccountId_externalThreadId_key" ON "conversations"("connectedAccountId", "externalThreadId");

-- CreateIndex
CREATE INDEX "messages_organizationId_channel_receivedAt_idx" ON "messages"("organizationId", "channel", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "messages_conversationId_receivedAt_idx" ON "messages"("conversationId", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "messages_contentHash_idx" ON "messages"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "messages_connectedAccountId_externalId_key" ON "messages"("connectedAccountId", "externalId");

-- CreateIndex
CREATE INDEX "message_attachments_storageStatus_idx" ON "message_attachments"("storageStatus");

-- CreateIndex
CREATE UNIQUE INDEX "message_attachments_messageId_externalId_key" ON "message_attachments"("messageId", "externalId");

-- CreateIndex
CREATE INDEX "gmail_sync_runs_connectedAccountId_startedAt_idx" ON "gmail_sync_runs"("connectedAccountId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "gmail_sync_runs_status_startedAt_idx" ON "gmail_sync_runs"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connected_accounts" ADD CONSTRAINT "connected_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_sync_runs" ADD CONSTRAINT "gmail_sync_runs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gmail_sync_runs" ADD CONSTRAINT "gmail_sync_runs_connectedAccountId_fkey" FOREIGN KEY ("connectedAccountId") REFERENCES "connected_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
