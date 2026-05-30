-- Firebase auth migration: add firebaseUid, make clerkUserId optional, add phone
ALTER TABLE "users" ALTER COLUMN "clerkUserId" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firebaseUid" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_firebaseUid_key" ON "users"("firebaseUid");
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");
