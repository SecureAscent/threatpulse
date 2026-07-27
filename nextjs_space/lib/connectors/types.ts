export type ConnectorKind =
  | "ASSET"
  | "THREAT"
  | "VULNERABILITY"
  | "TICKETING"
  | "NOTIFICATION";

export type SyncMode = "INCREMENTAL" | "FULL" | "DRY_RUN";

export interface ConnectorCredentials {
  baseUrl?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  additional?: Record<string, unknown>;
}

export interface ConnectorContext {
  organizationId: string;
  integrationConfigId: string;
  credentials: ConnectorCredentials;
  cursor?: string | null;
  mode: SyncMode;
  signal?: AbortSignal;
}

export interface ConnectionResult {
  ok: boolean;
  provider: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ExternalOwner {
  externalIdentity: string;
  displayName?: string;
  email?: string;
  businessUnit?: string;
  metadata?: Record<string, unknown>;
}

export interface ExternalAsset {
  externalId: string;
  name: string;
  assetType: string;
  description?: string;
  vendor?: string;
  productFamily?: string;
  model?: string;
  currentVersion?: string;
  criticality?: string;
  lifecycleStatus?: string;
  sourceStatus?: string;
  owner?: ExternalOwner;
  sourceUpdatedAt?: Date;
  rawMetadata?: Record<string, unknown>;
}

export interface ExternalProductVersion {
  externalId: string;
  assetExternalId: string;
  version: string;
  releaseName?: string;
  lifecycleStatus?: string;
  releaseDate?: Date;
  endOfSupportDate?: Date;
  sourceUpdatedAt?: Date;
  rawMetadata?: Record<string, unknown>;
}

export interface ExternalSbomDocument {
  externalId: string;
  productVersionExternalId: string;
  format: "CYCLONEDX" | "SPDX" | "PROPRIETARY" | string;
  specVersion?: string;
  serialNumber?: string;
  documentVersion?: number;
  generatedAt?: Date;
  checksum?: string;
  rawDocument?: Record<string, unknown>;
  rawMetadata?: Record<string, unknown>;
}

export interface ExternalComponent {
  externalId: string;
  sbomExternalId: string;
  name: string;
  version?: string;
  supplier?: string;
  componentType?: string;
  purl?: string;
  cpe?: string;
  swid?: string;
  licenseExpression?: string;
  relationshipType?: string;
  scope?: string;
  directDependency?: boolean;
  rawMetadata?: Record<string, unknown>;
}

export interface ExternalVulnerability {
  externalId: string;
  assetExternalId: string;
  productVersionExternalId?: string;
  componentExternalId?: string;
  vulnerabilityId: string;
  status?: string;
  vexStatus?: string;
  severity?: string;
  cvssScore?: number;
  epssScore?: number;
  kev?: boolean;
  exploitable?: boolean;
  firstSeenAt?: Date;
  lastSeenAt?: Date;
  sourceUpdatedAt?: Date;
  remediation?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface SyncPage<T> {
  records: T[];
  nextCursor?: string | null;
}

export interface AssetConnector {
  readonly id: string;
  readonly displayName: string;
  readonly kind: "ASSET";

  testConnection(context: ConnectorContext): Promise<ConnectionResult>;
  listAssets(context: ConnectorContext): AsyncIterable<SyncPage<ExternalAsset>>;
  listProductVersions(
    context: ConnectorContext,
  ): AsyncIterable<SyncPage<ExternalProductVersion>>;
  listSboms(
    context: ConnectorContext,
  ): AsyncIterable<SyncPage<ExternalSbomDocument>>;
  listComponents(
    context: ConnectorContext,
  ): AsyncIterable<SyncPage<ExternalComponent>>;
  listVulnerabilities(
    context: ConnectorContext,
  ): AsyncIterable<SyncPage<ExternalVulnerability>>;
}
