-- Exposure Monitoring Domain
CREATE TABLE IF NOT EXISTS "ExposureFinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "watchlistId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'credential_leak',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "affectedIdentity" TEXT,
    "credentialSample" TEXT,
    "credentialHash" TEXT,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "firstSeen" TIMESTAMP(3),
    "lastSeen" TIMESTAMP(3),
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "reliability" TEXT NOT NULL DEFAULT 'C',
    "attributionStatus" TEXT NOT NULL DEFAULT 'UNCONFIRMED',
    "fingerprint" TEXT,
    "termsClass" TEXT NOT NULL DEFAULT 'open',
    "status" TEXT NOT NULL DEFAULT 'new',
    "assignedTo" TEXT,
    "validationNotes" TEXT,
    "retentionExpires" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExposureFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExposureFinding_organizationId_idx" ON "ExposureFinding"("organizationId");
CREATE INDEX IF NOT EXISTS "ExposureFinding_status_idx" ON "ExposureFinding"("status");
CREATE INDEX IF NOT EXISTS "ExposureFinding_severity_idx" ON "ExposureFinding"("severity");

CREATE TABLE IF NOT EXISTS "ExposureEvidence" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceId" TEXT,
    "capturedDate" TIMESTAMP(3),
    "publishedDate" TIMESTAMP(3),
    "contentExcerpt" TEXT,
    "fingerprint" TEXT,
    "contentHash" TEXT,
    "termsClass" TEXT NOT NULL DEFAULT 'open',
    "revealed" BOOLEAN NOT NULL DEFAULT false,
    "revealExpires" TIMESTAMP(3),
    "revealAudit" TEXT,
    "retentionExpires" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExposureEvidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExposureEvidence_findingId_idx" ON "ExposureEvidence"("findingId");
CREATE INDEX IF NOT EXISTS "ExposureEvidence_organizationId_idx" ON "ExposureEvidence"("organizationId");
ALTER TABLE "ExposureEvidence" ADD CONSTRAINT "ExposureEvidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ExposureFinding"("id") ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS "TenantWatchlist" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'domain',
    "terms" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "ownerName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TenantWatchlist_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TenantWatchlist_organizationId_idx" ON "TenantWatchlist"("organizationId");

CREATE TABLE IF NOT EXISTS "IntelligenceSource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'feed',
    "licenseClass" TEXT NOT NULL DEFAULT 'open',
    "termsSummary" TEXT,
    "reliability" TEXT NOT NULL DEFAULT 'C',
    "defaultConfidence" TEXT NOT NULL DEFAULT 'medium',
    "authRequired" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastIngestedDate" TIMESTAMP(3),
    "ingestCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntelligenceSource_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "IntelligenceSource_organizationId_idx" ON "IntelligenceSource"("organizationId");
