# Data Classification, Retention & Source-Licensing Rules

## Data classification

| Class | Examples | Storage rule |
| --- | --- | --- |
| Public | Threat-actor names, TTPs, public reports, campaigns | Platform tables, shared |
| Internal | Source health, ingestion metrics, aggregate stats | Platform tables, authenticated read |
| Confidential | Tenant watchlists, monitored domains, exposure summaries | Tenant-scoped, organizationId enforced |
| Restricted | Credential samples (masked), evidence excerpts, reveal audit | Tenant-scoped, masked, reveal-gated, audit-logged |

## Sensitive-data prohibitions

Never stored: plaintext passwords, session tokens, private keys, full payment
data, complete identity records.

## Retention

| Data | Default retention | Action on expiry |
| --- | --- | --- |
| Platform intel (actors, campaigns, malware, indicators) | Indefinite | Retire (status), keep record |
| IntelligenceReport | Indefinite | Keep |
| TenantWatchlist | Life of subscription | Delete on offboarding |
| ExposureFinding | 12 months after remediation | Auto-delete (retention_expires) |
| ExposureEvidence | 90 days unless case open | Auto-delete; extend while case open |
| Reveal audit logs | 24 months | Keep |
| Source health logs | 30 days | Rotate |

A retention_expires timestamp is written on creation; a scheduled job prunes
expired restricted records.

## Source licensing

| License class | Examples | Rule |
| --- | --- | --- |
| commercial | Flare, Flashpoint, Recorded Future, SpyCloud | Per-seat/contract; track terms_class on each record; no redistribution |
| open | Ransomware.live, CISA, MITRE ATT&CK, abuse.ch | Attribution required; respect rate limits |
| restricted | Breach-notification feeds under NDA | NDA-gated; tenant-scoped only; no cross-tenant exposure |

Each IntelligenceSource record carries license_class and terms_summary; every
finding/evidence/indicator inherits the source's terms_class.

## Tor / direct collection

Not permitted in the first release. All intelligence enters via licensed APIs,
authorized feeds, breach-notification services, or public sources. A future
release may add managed collection after legal review.

## Idempotent migration

Model migrations are idempotent: re-running creates missing tables/indexes
without dropping data. organizationId is backfilled as null then populated per
tenant; records with null organizationId are treated as platform intelligence.
