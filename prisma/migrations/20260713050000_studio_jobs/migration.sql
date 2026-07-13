-- CreateTable
CREATE TABLE "studio_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "studio_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_jobs_organizationId_idx" ON "studio_jobs"("organizationId");

-- AddForeignKey
ALTER TABLE "studio_jobs" ADD CONSTRAINT "studio_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
