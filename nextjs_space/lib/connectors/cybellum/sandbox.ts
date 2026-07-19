import type {
  AssetConnector,
  ConnectionResult,
  ConnectorContext,
  ExternalAsset,
  ExternalComponent,
  ExternalProductVersion,
  ExternalSbomDocument,
  ExternalVulnerability,
  SyncPage,
} from "../types";

const assets: ExternalAsset[] = [
  {
    externalId: "cyb-product-001",
    name: "ThreatPulse Demo Controller",
    assetType: "PRODUCT",
    vendor: "Demo Manufacturing",
    productFamily: "Industrial Controls",
    model: "TPC-1000",
    currentVersion: "4.2.0",
    criticality: "CRITICAL",
    lifecycleStatus: "SUPPORTED",
    sourceStatus: "ACTIVE",
    owner: {
      externalIdentity: "product-security@example.invalid",
      displayName: "Product Security Team",
      email: "product-security@example.invalid",
      businessUnit: "Engineering",
    },
    sourceUpdatedAt: new Date("2026-07-01T12:00:00.000Z"),
    rawMetadata: { sandbox: true },
  },
];

const productVersions: ExternalProductVersion[] = [
  {
    externalId: "cyb-version-001",
    assetExternalId: "cyb-product-001",
    version: "4.2.0",
    releaseName: "Summer 2026",
    lifecycleStatus: "SUPPORTED",
    releaseDate: new Date("2026-06-15T00:00:00.000Z"),
    rawMetadata: { sandbox: true },
  },
];

const sboms: ExternalSbomDocument[] = [
  {
    externalId: "cyb-sbom-001",
    productVersionExternalId: "cyb-version-001",
    format: "CYCLONEDX",
    specVersion: "1.6",
    serialNumber: "urn:uuid:7a9b6ab6-fb98-4b9d-a898-ff6eb68413f0",
    documentVersion: 1,
    generatedAt: new Date("2026-06-15T01:00:00.000Z"),
    rawMetadata: { sandbox: true },
  },
];

const components: ExternalComponent[] = [
  {
    externalId: "cyb-component-openssl-3.0.13",
    sbomExternalId: "cyb-sbom-001",
    name: "openssl",
    version: "3.0.13",
    supplier: "OpenSSL Software Foundation",
    componentType: "library",
    purl: "pkg:generic/openssl@3.0.13",
    directDependency: true,
    rawMetadata: { sandbox: true },
  },
];

const vulnerabilities: ExternalVulnerability[] = [
  {
    externalId: "cyb-finding-001",
    assetExternalId: "cyb-product-001",
    productVersionExternalId: "cyb-version-001",
    componentExternalId: "cyb-component-openssl-3.0.13",
    vulnerabilityId: "CVE-2026-0001",
    status: "OPEN",
    vexStatus: "AFFECTED",
    severity: "HIGH",
    cvssScore: 8.8,
    exploitable: true,
    firstSeenAt: new Date("2026-06-16T00:00:00.000Z"),
    lastSeenAt: new Date("2026-07-01T00:00:00.000Z"),
    remediation: "Upgrade to the vendor-approved fixed component version.",
    rawMetadata: { sandbox: true },
  },
];

async function* onePage<T>(records: T[]): AsyncIterable<SyncPage<T>> {
  yield { records, nextCursor: null };
}

export class CybellumSandboxConnector implements AssetConnector {
  readonly id = "cybellum-sandbox";
  readonly displayName = "Cybellum Sandbox";
  readonly kind = "ASSET" as const;

  async testConnection(context: ConnectorContext): Promise<ConnectionResult> {
    return {
      ok: context.organizationId.length > 0,
      provider: this.id,
      message: "Offline Cybellum sandbox is available.",
      details: { mode: context.mode, liveConnection: false },
    };
  }

  listAssets(): AsyncIterable<SyncPage<ExternalAsset>> {
    return onePage(assets);
  }

  listProductVersions(): AsyncIterable<SyncPage<ExternalProductVersion>> {
    return onePage(productVersions);
  }

  listSboms(): AsyncIterable<SyncPage<ExternalSbomDocument>> {
    return onePage(sboms);
  }

  listComponents(): AsyncIterable<SyncPage<ExternalComponent>> {
    return onePage(components);
  }

  listVulnerabilities(): AsyncIterable<SyncPage<ExternalVulnerability>> {
    return onePage(vulnerabilities);
  }
}
