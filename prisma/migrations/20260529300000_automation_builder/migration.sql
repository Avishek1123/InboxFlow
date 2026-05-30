-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "AutomationTriggerType" AS ENUM ('NEW_GMAIL_EMAIL', 'NEW_WHATSAPP_MESSAGE', 'SCHEDULED_TIME', 'AI_EXTRACTION_COMPLETED');
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRYING', 'CANCELLED');
CREATE TYPE "AutomationStepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AutomationStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" "AutomationTriggerType" NOT NULL,
    "graph" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "cronExpression" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automation_executions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "triggerType" "AutomationTriggerType" NOT NULL,
    "triggerPayload" JSONB NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automation_execution_steps" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "label" TEXT,
    "status" "AutomationStepStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "automation_execution_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "source" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automation_data_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "automationId" TEXT,
    "executionId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "automation_data_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "automations_organizationId_status_idx" ON "automations"("organizationId", "status");
CREATE INDEX "automations_organizationId_triggerType_status_idx" ON "automations"("organizationId", "triggerType", "status");
CREATE INDEX "automation_executions_automationId_startedAt_idx" ON "automation_executions"("automationId", "startedAt" DESC);
CREATE INDEX "automation_executions_organizationId_status_startedAt_idx" ON "automation_executions"("organizationId", "status", "startedAt" DESC);
CREATE INDEX "automation_executions_status_nextRetryAt_idx" ON "automation_executions"("status", "nextRetryAt");
CREATE INDEX "automation_execution_steps_executionId_startedAt_idx" ON "automation_execution_steps"("executionId", "startedAt");
CREATE INDEX "contacts_organizationId_email_idx" ON "contacts"("organizationId", "email");
CREATE INDEX "contacts_organizationId_phone_idx" ON "contacts"("organizationId", "phone");
CREATE INDEX "automation_data_records_organizationId_key_idx" ON "automation_data_records"("organizationId", "key");
CREATE INDEX "automation_data_records_executionId_idx" ON "automation_data_records"("executionId");

ALTER TABLE "automations" ADD CONSTRAINT "automations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_execution_steps" ADD CONSTRAINT "automation_execution_steps_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "automation_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_data_records" ADD CONSTRAINT "automation_data_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
