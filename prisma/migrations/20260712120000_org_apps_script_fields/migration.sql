-- AlterTable: Apps Script helper fields used by sheet provisioning
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "inboxflowAppsScriptId" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "inboxflowScriptGcpReady" BOOLEAN DEFAULT false;
