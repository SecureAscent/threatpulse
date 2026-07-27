-- CreateTable
CREATE TABLE "ParentOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "parentOrganizationId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ANALYST',
    "organizationId" TEXT,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Threat" (
    "id" TEXT NOT NULL,
    "threatId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "description" TEXT,
    "affectedAssets" TEXT,
    "source" TEXT,
    "indicators" TEXT,
    "mitreTactic" TEXT,
    "mitreTechnique" TEXT,
    "cvssScore" DOUBLE PRECISION,
    "dateAdded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT,

    CONSTRAINT "Threat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "configData" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT,
    "ownerUserId" TEXT,
    "externalSource" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "productFamily" TEXT,
    "model" TEXT,
    "currentVersion" TEXT,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "businessUnit" TEXT,
    "criticality" TEXT,
    "lifecycleStatus" TEXT,
    "sourceStatus" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "sourceDeletedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "externalSource" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "releaseName" TEXT,
    "lifecycleStatus" TEXT,
    "releaseDate" TIMESTAMP(3),
    "endOfSupportDate" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SbomDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productVersionId" TEXT NOT NULL,
    "externalSource" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "specVersion" TEXT,
    "serialNumber" TEXT,
    "documentVersion" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "checksum" TEXT,
    "rawDocument" JSONB,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SbomDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareComponent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalSource" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "supplier" TEXT,
    "componentType" TEXT,
    "purl" TEXT,
    "cpe" TEXT,
    "swid" TEXT,
    "licenseExpression" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SbomComponent" (
    "id" TEXT NOT NULL,
    "sbomDocumentId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "relationshipType" TEXT,
    "scope" TEXT,
    "directDependency" BOOLEAN,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SbomComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetVulnerability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "productVersionId" TEXT,
    "componentId" TEXT,
    "externalSource" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "vulnerabilityId" TEXT NOT NULL,
    "status" TEXT,
    "vexStatus" TEXT,
    "severity" TEXT,
    "cvssScore" DOUBLE PRECISION,
    "epssScore" DOUBLE PRECISION,
    "kev" BOOLEAN,
    "exploitable" BOOLEAN,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "remediation" TEXT,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetVulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSyncRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "integrationConfigId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "cursorBefore" TEXT,
    "cursorAfter" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsDeleted" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ExternalSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentityMapping" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "externalSource" TEXT NOT NULL,
    "externalIdentity" TEXT NOT NULL,
    "externalDisplayName" TEXT,
    "mappingMethod" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalIdentityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "departmentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentOrganization_slug_key" ON "ParentOrganization"("slug");

-- CreateIndex
CREATE INDEX "ParentOrganization_archivedAt_idx" ON "ParentOrganization"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_parentOrganizationId_idx" ON "Organization"("parentOrganizationId");

-- CreateIndex
CREATE INDEX "Organization_archivedAt_idx" ON "Organization"("archivedAt");

-- CreateIndex
CREATE INDEX "Department_organizationId_idx" ON "Department"("organizationId");

-- CreateIndex
CREATE INDEX "Department_archivedAt_idx" ON "Department"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_slug_key" ON "Department"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- CreateIndex
CREATE INDEX "Threat_organizationId_type_idx" ON "Threat"("organizationId", "type");

-- CreateIndex
CREATE INDEX "Threat_organizationId_severity_idx" ON "Threat"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "Threat_organizationId_status_idx" ON "Threat"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Threat_dateAdded_idx" ON "Threat"("dateAdded");

-- CreateIndex
CREATE UNIQUE INDEX "Threat_organizationId_threatId_key" ON "Threat"("organizationId", "threatId");

-- CreateIndex
CREATE INDEX "IntegrationConfig_organizationId_idx" ON "IntegrationConfig"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConfig_organizationId_integrationId_key" ON "IntegrationConfig"("organizationId", "integrationId");

-- CreateIndex
CREATE INDEX "Asset_organizationId_assetType_idx" ON "Asset"("organizationId", "assetType");

-- CreateIndex
CREATE INDEX "Asset_organizationId_businessUnit_idx" ON "Asset"("organizationId", "businessUnit");

-- CreateIndex
CREATE INDEX "Asset_organizationId_criticality_idx" ON "Asset"("organizationId", "criticality");

-- CreateIndex
CREATE INDEX "Asset_organizationId_lifecycleStatus_idx" ON "Asset"("organizationId", "lifecycleStatus");

-- CreateIndex
CREATE INDEX "Asset_departmentId_idx" ON "Asset"("departmentId");

-- CreateIndex
CREATE INDEX "Asset_ownerUserId_idx" ON "Asset"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_organizationId_externalSource_externalId_key" ON "Asset"("organizationId", "externalSource", "externalId");

-- CreateIndex
CREATE INDEX "ProductVersion_organizationId_assetId_idx" ON "ProductVersion"("organizationId", "assetId");

-- CreateIndex
CREATE INDEX "ProductVersion_organizationId_lifecycleStatus_idx" ON "ProductVersion"("organizationId", "lifecycleStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVersion_organizationId_externalSource_externalId_key" ON "ProductVersion"("organizationId", "externalSource", "externalId");

-- CreateIndex
CREATE INDEX "SbomDocument_organizationId_productVersionId_idx" ON "SbomDocument"("organizationId", "productVersionId");

-- CreateIndex
CREATE INDEX "SbomDocument_organizationId_generatedAt_idx" ON "SbomDocument"("organizationId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SbomDocument_organizationId_externalSource_externalId_key" ON "SbomDocument"("organizationId", "externalSource", "externalId");

-- CreateIndex
CREATE INDEX "SoftwareComponent_organizationId_name_version_idx" ON "SoftwareComponent"("organizationId", "name", "version");

-- CreateIndex
CREATE INDEX "SoftwareComponent_organizationId_purl_idx" ON "SoftwareComponent"("organizationId", "purl");

-- CreateIndex
CREATE INDEX "SoftwareComponent_organizationId_cpe_idx" ON "SoftwareComponent"("organizationId", "cpe");

-- CreateIndex
CREATE UNIQUE INDEX "SoftwareComponent_organizationId_externalSource_externalId_key" ON "SoftwareComponent"("organizationId", "externalSource", "externalId");

-- CreateIndex
CREATE INDEX "SbomComponent_componentId_idx" ON "SbomComponent"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "SbomComponent_sbomDocumentId_componentId_key" ON "SbomComponent"("sbomDocumentId", "componentId");

-- CreateIndex
CREATE INDEX "AssetVulnerability_organizationId_vulnerabilityId_idx" ON "AssetVulnerability"("organizationId", "vulnerabilityId");

-- CreateIndex
CREATE INDEX "AssetVulnerability_organizationId_severity_idx" ON "AssetVulnerability"("organizationId", "severity");

-- CreateIndex
CREATE INDEX "AssetVulnerability_organizationId_kev_idx" ON "AssetVulnerability"("organizationId", "kev");

-- CreateIndex
CREATE INDEX "AssetVulnerability_assetId_idx" ON "AssetVulnerability"("assetId");

-- CreateIndex
CREATE INDEX "AssetVulnerability_productVersionId_idx" ON "AssetVulnerability"("productVersionId");

-- CreateIndex
CREATE INDEX "AssetVulnerability_componentId_idx" ON "AssetVulnerability"("componentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetVulnerability_organizationId_externalSource_externalId_key" ON "AssetVulnerability"("organizationId", "externalSource", "externalId");

-- CreateIndex
CREATE INDEX "ExternalSyncRun_organizationId_provider_startedAt_idx" ON "ExternalSyncRun"("organizationId", "provider", "startedAt");

-- CreateIndex
CREATE INDEX "ExternalSyncRun_integrationConfigId_startedAt_idx" ON "ExternalSyncRun"("integrationConfigId", "startedAt");

-- CreateIndex
CREATE INDEX "ExternalSyncRun_status_startedAt_idx" ON "ExternalSyncRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ExternalIdentityMapping_organizationId_userId_idx" ON "ExternalIdentityMapping"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentityMapping_organizationId_externalSource_exter_key" ON "ExternalIdentityMapping"("organizationId", "externalSource", "externalIdentity");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_action_idx" ON "AuditEvent"("organizationId", "action");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_parentOrganizationId_fkey" FOREIGN KEY ("parentOrganizationId") REFERENCES "ParentOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Threat" ADD CONSTRAINT "Threat_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Threat" ADD CONSTRAINT "Threat_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVersion" ADD CONSTRAINT "ProductVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SbomDocument" ADD CONSTRAINT "SbomDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SbomDocument" ADD CONSTRAINT "SbomDocument_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareComponent" ADD CONSTRAINT "SoftwareComponent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SbomComponent" ADD CONSTRAINT "SbomComponent_sbomDocumentId_fkey" FOREIGN KEY ("sbomDocumentId") REFERENCES "SbomDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SbomComponent" ADD CONSTRAINT "SbomComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SoftwareComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVulnerability" ADD CONSTRAINT "AssetVulnerability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVulnerability" ADD CONSTRAINT "AssetVulnerability_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVulnerability" ADD CONSTRAINT "AssetVulnerability_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetVulnerability" ADD CONSTRAINT "AssetVulnerability_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "SoftwareComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSyncRun" ADD CONSTRAINT "ExternalSyncRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalSyncRun" ADD CONSTRAINT "ExternalSyncRun_integrationConfigId_fkey" FOREIGN KEY ("integrationConfigId") REFERENCES "IntegrationConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentityMapping" ADD CONSTRAINT "ExternalIdentityMapping_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentityMapping" ADD CONSTRAINT "ExternalIdentityMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
