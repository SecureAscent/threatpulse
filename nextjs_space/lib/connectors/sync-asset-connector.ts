import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  AssetConnector,
  ConnectorContext,
  ExternalAsset,
  ExternalComponent,
  ExternalProductVersion,
  ExternalSbomDocument,
  ExternalVulnerability,
  SyncMode,
} from "./types";

export interface AssetSyncRequest {
  organizationId: string;
  integrationConfigId: string;
  connector: AssetConnector;
  credentials?: ConnectorContext["credentials"];
  cursor?: string | null;
  mode?: SyncMode;
  signal?: AbortSignal;
}

export interface AssetSyncResult {
  syncRunId: string;
  status: "COMPLETED" | "FAILED";
  recordsRead: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  cursorAfter: string | null;
}

type SyncCounters = Omit<
  AssetSyncResult,
  "syncRunId" | "status" | "cursorAfter"
>;

function json(value: Record<string, unknown> | undefined): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Asset synchronization was aborted.");
  }
}

async function recordExists(
  prisma: PrismaClient,
  model: "asset" | "productVersion" | "sbomDocument" | "softwareComponent" | "assetVulnerability",
  organizationId: string,
  externalSource: string,
  externalId: string,
): Promise<boolean> {
  const where = {
    organizationId_externalSource_externalId: {
      organizationId,
      externalSource,
      externalId,
    },
  };

  return Boolean(await prisma[model].findUnique({ where, select: { id: true } } as never));
}

function countWrite(existed: boolean, counters: SyncCounters): void {
  counters.recordsRead += 1;
  if (existed) counters.recordsUpdated += 1;
  else counters.recordsCreated += 1;
}

export async function syncAssetConnector(
  prisma: PrismaClient,
  request: AssetSyncRequest,
): Promise<AssetSyncResult> {
  const mode = request.mode ?? "INCREMENTAL";
  const integration = await prisma.integrationConfig.findFirst({
    where: {
      id: request.integrationConfigId,
      organizationId: request.organizationId,
    },
    select: { id: true },
  });

  if (!integration) {
    throw new Error("Integration configuration does not belong to this organization.");
  }

  const context: ConnectorContext = {
    organizationId: request.organizationId,
    integrationConfigId: request.integrationConfigId,
    credentials: request.credentials ?? {},
    cursor: request.cursor ?? null,
    mode,
    signal: request.signal,
  };

  const connection = await request.connector.testConnection(context);
  if (!connection.ok) {
    throw new Error(connection.message || "Connector connection test failed.");
  }

  const syncRun = await prisma.externalSyncRun.create({
    data: {
      organizationId: request.organizationId,
      integrationConfigId: request.integrationConfigId,
      provider: request.connector.id,
      syncType: mode,
      status: "RUNNING",
      cursorBefore: request.cursor ?? null,
      metadata: json({ connector: request.connector.displayName }),
    },
    select: { id: true },
  });

  const counters: SyncCounters = {
    recordsRead: 0,
    recordsCreated: 0,
    recordsUpdated: 0,
    recordsFailed: 0,
  };
  let cursorAfter = request.cursor ?? null;

  const assetIds = new Map<string, string>();
  const versionIds = new Map<string, string>();
  const sbomIds = new Map<string, string>();
  const componentIds = new Map<string, string>();
  const now = new Date();

  try {
    for await (const page of request.connector.listAssets(context)) {
      throwIfAborted(request.signal);
      cursorAfter = page.nextCursor ?? cursorAfter;

      for (const source of page.records) {
        await upsertAsset(prisma, request, source, assetIds, counters, now, mode);
      }
    }

    for await (const page of request.connector.listProductVersions(context)) {
      throwIfAborted(request.signal);
      cursorAfter = page.nextCursor ?? cursorAfter;

      for (const source of page.records) {
        const assetId = assetIds.get(source.assetExternalId);
        if (!assetId) throw new Error(`Missing asset for product version ${source.externalId}.`);
        await upsertProductVersion(prisma, request, source, assetId, versionIds, counters, now, mode);
      }
    }

    for await (const page of request.connector.listSboms(context)) {
      throwIfAborted(request.signal);
      cursorAfter = page.nextCursor ?? cursorAfter;

      for (const source of page.records) {
        const productVersionId = versionIds.get(source.productVersionExternalId);
        if (!productVersionId) throw new Error(`Missing product version for SBOM ${source.externalId}.`);
        await upsertSbom(prisma, request, source, productVersionId, sbomIds, counters, now, mode);
      }
    }

    for await (const page of request.connector.listComponents(context)) {
      throwIfAborted(request.signal);
      cursorAfter = page.nextCursor ?? cursorAfter;

      for (const source of page.records) {
        const sbomDocumentId = sbomIds.get(source.sbomExternalId);
        if (!sbomDocumentId) throw new Error(`Missing SBOM for component ${source.externalId}.`);
        await upsertComponent(prisma, request, source, sbomDocumentId, componentIds, counters, now, mode);
      }
    }

    for await (const page of request.connector.listVulnerabilities(context)) {
      throwIfAborted(request.signal);
      cursorAfter = page.nextCursor ?? cursorAfter;

      for (const source of page.records) {
        const assetId = assetIds.get(source.assetExternalId);
        if (!assetId) throw new Error(`Missing asset for vulnerability ${source.externalId}.`);
        await upsertVulnerability(
          prisma,
          request,
          source,
          assetId,
          source.productVersionExternalId ? versionIds.get(source.productVersionExternalId) : undefined,
          source.componentExternalId ? componentIds.get(source.componentExternalId) : undefined,
          counters,
          mode,
        );
      }
    }

    await prisma.externalSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        cursorAfter,
        ...counters,
      },
    });

    return { syncRunId: syncRun.id, status: "COMPLETED", cursorAfter, ...counters };
  } catch (error) {
    counters.recordsFailed += 1;
    const message = error instanceof Error ? error.message : "Unknown synchronization failure.";

    await prisma.externalSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        cursorAfter,
        errorMessage: message.slice(0, 4000),
        ...counters,
      },
    });

    throw error;
  }
}

async function upsertAsset(
  prisma: PrismaClient,
  request: AssetSyncRequest,
  source: ExternalAsset,
  ids: Map<string, string>,
  counters: SyncCounters,
  now: Date,
  mode: SyncMode,
): Promise<void> {
  const existed = await recordExists(prisma, "asset", request.organizationId, request.connector.id, source.externalId);
  countWrite(existed, counters);
  if (mode === "DRY_RUN") return;

  const ownerUser = source.owner?.email
    ? await prisma.user.findFirst({
        where: { organizationId: request.organizationId, email: source.owner.email },
        select: { id: true },
      })
    : null;

  const asset = await prisma.asset.upsert({
    where: {
      organizationId_externalSource_externalId: {
        organizationId: request.organizationId,
        externalSource: request.connector.id,
        externalId: source.externalId,
      },
    },
    create: {
      organizationId: request.organizationId,
      externalSource: request.connector.id,
      externalId: source.externalId,
      assetType: source.assetType,
      name: source.name,
      description: source.description,
      vendor: source.vendor,
      productFamily: source.productFamily,
      model: source.model,
      currentVersion: source.currentVersion,
      ownerName: source.owner?.displayName,
      ownerEmail: source.owner?.email,
      ownerUserId: ownerUser?.id,
      businessUnit: source.owner?.businessUnit,
      criticality: source.criticality,
      lifecycleStatus: source.lifecycleStatus,
      sourceStatus: source.sourceStatus,
      sourceUpdatedAt: source.sourceUpdatedAt,
      lastSeenAt: now,
      lastSyncedAt: now,
      rawMetadata: json(source.rawMetadata),
    },
    update: {
      assetType: source.assetType,
      name: source.name,
      description: source.description,
      vendor: source.vendor,
      productFamily: source.productFamily,
      model: source.model,
      currentVersion: source.currentVersion,
      ownerName: source.owner?.displayName,
      ownerEmail: source.owner?.email,
      ownerUserId: ownerUser?.id,
      businessUnit: source.owner?.businessUnit,
      criticality: source.criticality,
      lifecycleStatus: source.lifecycleStatus,
      sourceStatus: source.sourceStatus,
      sourceUpdatedAt: source.sourceUpdatedAt,
      sourceDeletedAt: null,
      lastSeenAt: now,
      lastSyncedAt: now,
      rawMetadata: json(source.rawMetadata),
    },
    select: { id: true },
  });

  ids.set(source.externalId, asset.id);
}

async function upsertProductVersion(
  prisma: PrismaClient,
  request: AssetSyncRequest,
  source: ExternalProductVersion,
  assetId: string,
  ids: Map<string, string>,
  counters: SyncCounters,
  now: Date,
  mode: SyncMode,
): Promise<void> {
  const existed = await recordExists(prisma, "productVersion", request.organizationId, request.connector.id, source.externalId);
  countWrite(existed, counters);
  if (mode === "DRY_RUN") return;

  const record = await prisma.productVersion.upsert({
    where: { organizationId_externalSource_externalId: { organizationId: request.organizationId, externalSource: request.connector.id, externalId: source.externalId } },
    create: { organizationId: request.organizationId, assetId, externalSource: request.connector.id, externalId: source.externalId, version: source.version, releaseName: source.releaseName, lifecycleStatus: source.lifecycleStatus, releaseDate: source.releaseDate, endOfSupportDate: source.endOfSupportDate, sourceUpdatedAt: source.sourceUpdatedAt, lastSeenAt: now, rawMetadata: json(source.rawMetadata) },
    update: { assetId, version: source.version, releaseName: source.releaseName, lifecycleStatus: source.lifecycleStatus, releaseDate: source.releaseDate, endOfSupportDate: source.endOfSupportDate, sourceUpdatedAt: source.sourceUpdatedAt, lastSeenAt: now, rawMetadata: json(source.rawMetadata) },
    select: { id: true },
  });
  ids.set(source.externalId, record.id);
}

async function upsertSbom(
  prisma: PrismaClient,
  request: AssetSyncRequest,
  source: ExternalSbomDocument,
  productVersionId: string,
  ids: Map<string, string>,
  counters: SyncCounters,
  now: Date,
  mode: SyncMode,
): Promise<void> {
  const existed = await recordExists(prisma, "sbomDocument", request.organizationId, request.connector.id, source.externalId);
  countWrite(existed, counters);
  if (mode === "DRY_RUN") return;

  const record = await prisma.sbomDocument.upsert({
    where: { organizationId_externalSource_externalId: { organizationId: request.organizationId, externalSource: request.connector.id, externalId: source.externalId } },
    create: { organizationId: request.organizationId, productVersionId, externalSource: request.connector.id, externalId: source.externalId, format: source.format, specVersion: source.specVersion, serialNumber: source.serialNumber, documentVersion: source.documentVersion, generatedAt: source.generatedAt, checksum: source.checksum, lastSeenAt: now, rawDocument: json(source.rawDocument), rawMetadata: json(source.rawMetadata) },
    update: { productVersionId, format: source.format, specVersion: source.specVersion, serialNumber: source.serialNumber, documentVersion: source.documentVersion, generatedAt: source.generatedAt, checksum: source.checksum, lastSeenAt: now, rawDocument: json(source.rawDocument), rawMetadata: json(source.rawMetadata) },
    select: { id: true },
  });
  ids.set(source.externalId, record.id);
}

async function upsertComponent(
  prisma: PrismaClient,
  request: AssetSyncRequest,
  source: ExternalComponent,
  sbomDocumentId: string,
  ids: Map<string, string>,
  counters: SyncCounters,
  now: Date,
  mode: SyncMode,
): Promise<void> {
  const existed = await recordExists(prisma, "softwareComponent", request.organizationId, request.connector.id, source.externalId);
  countWrite(existed, counters);
  if (mode === "DRY_RUN") return;

  const component = await prisma.softwareComponent.upsert({
    where: { organizationId_externalSource_externalId: { organizationId: request.organizationId, externalSource: request.connector.id, externalId: source.externalId } },
    create: { organizationId: request.organizationId, externalSource: request.connector.id, externalId: source.externalId, name: source.name, version: source.version, supplier: source.supplier, componentType: source.componentType, purl: source.purl, cpe: source.cpe, swid: source.swid, licenseExpression: source.licenseExpression, lastSeenAt: now, rawMetadata: json(source.rawMetadata) },
    update: { name: source.name, version: source.version, supplier: source.supplier, componentType: source.componentType, purl: source.purl, cpe: source.cpe, swid: source.swid, licenseExpression: source.licenseExpression, lastSeenAt: now, rawMetadata: json(source.rawMetadata) },
    select: { id: true },
  });

  await prisma.sbomComponent.upsert({
    where: { sbomDocumentId_componentId: { sbomDocumentId, componentId: component.id } },
    create: { sbomDocumentId, componentId: component.id, relationshipType: source.relationshipType, scope: source.scope, directDependency: source.directDependency, rawMetadata: json(source.rawMetadata) },
    update: { relationshipType: source.relationshipType, scope: source.scope, directDependency: source.directDependency, rawMetadata: json(source.rawMetadata) },
  });
  ids.set(source.externalId, component.id);
}

async function upsertVulnerability(
  prisma: PrismaClient,
  request: AssetSyncRequest,
  source: ExternalVulnerability,
  assetId: string,
  productVersionId: string | undefined,
  componentId: string | undefined,
  counters: SyncCounters,
  mode: SyncMode,
): Promise<void> {
  const existed = await recordExists(prisma, "assetVulnerability", request.organizationId, request.connector.id, source.externalId);
  countWrite(existed, counters);
  if (mode === "DRY_RUN") return;

  await prisma.assetVulnerability.upsert({
    where: { organizationId_externalSource_externalId: { organizationId: request.organizationId, externalSource: request.connector.id, externalId: source.externalId } },
    create: { organizationId: request.organizationId, assetId, productVersionId, componentId, externalSource: request.connector.id, externalId: source.externalId, vulnerabilityId: source.vulnerabilityId, status: source.status, vexStatus: source.vexStatus, severity: source.severity, cvssScore: source.cvssScore, epssScore: source.epssScore, kev: source.kev, exploitable: source.exploitable, firstSeenAt: source.firstSeenAt, lastSeenAt: source.lastSeenAt, sourceUpdatedAt: source.sourceUpdatedAt, remediation: source.remediation, rawMetadata: json(source.rawMetadata) },
    update: { assetId, productVersionId, componentId, vulnerabilityId: source.vulnerabilityId, status: source.status, vexStatus: source.vexStatus, severity: source.severity, cvssScore: source.cvssScore, epssScore: source.epssScore, kev: source.kev, exploitable: source.exploitable, firstSeenAt: source.firstSeenAt, lastSeenAt: source.lastSeenAt, sourceUpdatedAt: source.sourceUpdatedAt, remediation: source.remediation, rawMetadata: json(source.rawMetadata) },
  });
}
