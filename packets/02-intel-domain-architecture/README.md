# Port Packet #02 — Intelligence Domain Architecture & MVP Plan

Status: Approved for architecture and MVP development (conditional).
This packet is the authoritative design and supersedes the Port #01 catch-all approach.

## Verdict (accepted)

Port #01 was strategically strong but not ready for direct implementation on the
existing Threat model and collector flow. Dark-web intelligence is built here as a
SEPARATE intelligence domain that correlates INTO ThreatPulse's threat and asset
workflows — never as an extension of the Threat table.

## Two intelligence classes

| Class | Visibility | Examples |
| --- | --- | --- |
| Platform intelligence | Shared, centrally managed | Threat actors, ransomware groups, campaigns, malware, TTPs, public reports |
| Tenant intelligence | Strictly organization-scoped | Leaked credentials, monitored domains, executive mentions, customer evidence, analyst cases |

Every tenant-derived record carries organizationId. Relationships are validated so
an exposure, watchlist, case, asset, department, and assigned user cannot cross
organizations.

## Critical controls

1. Tenant isolation — dark-web findings never land in a globally shared table.
2. Sensitive-data handling — never store plaintext passwords, session tokens,
   private keys, full payment data, or complete identity records. Store masked
   samples, hashes/fingerprints, source metadata, timestamps, and
   analyst-approved excerpts.
3. Source authorization — first release uses licensed APIs, authorized feeds,
   breach-notification services, and public intelligence. No own Tor crawler.
4. Evidence provenance — every finding carries source + retrieval timestamp,
   original publication timestamp, confidence, reliability rating, evidence
   fingerprint, terms/license class, retention/deletion date, and analyst
   validation status.
5. Attribution discipline — UNCONFIRMED, POSSIBLE, PROBABLE, CONFIRMED. A weak
   alias or IOC match is never shown as confirmed.
6. Access control — dedicated permissions: intel.read, intel.manage,
   darkweb.read, darkweb.manage, exposures.reveal, watchlists.manage,
   intel.sources.manage. Sensitive evidence requires an explicit reveal with
   audit logging.

## Recommended core models

Platform intelligence: ThreatActor, ThreatActorAlias, Campaign, MalwareFamily,
IntelligenceSource, IntelligenceReport, Indicator, ActorIndicator,
ActorTechnique.

Tenant intelligence: TenantWatchlist, ExposureFinding, ExposureEvidence,
IntelligenceCase.

Full field specs: backend/contract.md.
Data classification, retention, and source-licensing rules: docs/data-classification.md.

## MVP first release

- Threat-actor profiles and aliases
- MITRE ATT&CK technique mapping
- Actor / malware / campaign / IOC relationships
- Tenant-specific domain and keyword watchlists
- Exposed-credential notifications with masking
- Source confidence and evidence provenance
- Analyst validation and false-positive workflow
- Correlation to existing ThreatPulse assets, CVEs, and Jira workflow
- Executive reporting by actor, campaign, exposure type, and business unit
- Source health and ingestion metrics

## Deferred (not in first release)

Automated Tor collection, forum interaction, cryptocurrency tracing, persona
operations, AI-generated attribution conclusions.

## Implementation order

1. Define data classification, retention, and source-licensing rules
2. Add intelligence and tenant-exposure models with an idempotent migration
3. Introduce granular RBAC and API-key scopes
4. Build a normalized provider interface (do not embed providers in the collector)
5. Add ingestion, deduplication, confidence scoring, and provenance
6. Build actor, campaign, exposure, watchlist, and case APIs
7. Add the analyst UI and executive reporting
8. Run tenancy, migration, security, and rollback testing

## This packet

SPECIFICATION ONLY (architecture + model contracts + policy). Subsequent packets
deliver the model migrations, provider interface, ingestion, APIs, and UI.
