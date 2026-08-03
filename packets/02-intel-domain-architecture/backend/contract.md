# Backend Contract — Intelligence Domain Models & APIs

## Enums

Attribution status: UNCONFIRMED, POSSIBLE, PROBABLE, CONFIRMED
Confidence: low, medium, high
Reliability (Admiralty): A, B, C, D, E, F

## Platform intelligence models

### ThreatActor
| Field | Type | Notes |
| --- | --- | --- |
| name | string | required |
| kind | enum | threat_actor, ransomware_group, campaign, other |
| attribution_status | enum | default UNCONFIRMED |
| confidence | enum | low/medium/high |
| reliability | enum | Admiralty A-F |
| country | string | |
| targets | string | comma-separated |
| mitre_tactics | string | comma-separated ATT&CK IDs (e.g. T1059) |
| description | string | |
| first_seen | datetime | |
| last_seen | datetime | |
| source_ids | string | comma-separated IntelligenceSource IDs |
| source_url | uri | |
| notes | string | |

### ThreatActorAlias
| Field | Type | Notes |
| --- | --- | --- |
| actor_id | string | required, ref ThreatActor |
| alias | string | required |
| origin | enum | self_reported, intel_attribution, media, historical |
| confidence | enum | low/medium/high |
| notes | string | |

### Campaign
| Field | Type | Notes |
| --- | --- | --- |
| name | string | required |
| description | string | |
| actor_ids | string | comma-separated |
| first_seen | datetime | |
| last_seen | datetime | |
| status | enum | active, dormant, retired |
| objectives | string | |
| source_ids | string | comma-separated |
| notes | string | |

### MalwareFamily
| Field | Type | Notes |
| --- | --- | --- |
| name | string | required |
| aliases | string | comma-separated |
| actor_ids | string | comma-separated |
| first_seen | datetime | |
| description | string | |
| platforms | string | comma-separated |
| source_ids | string | comma-separated |
| notes | string | |

### IntelligenceSource
| Field | Type | Notes |
| --- | --- | --- |
| name | string | required |
| provider | string | Flare, Flashpoint, SpyCloud, Ransomware.live, CISA, MITRE |
| kind | enum | feed, breach_notification, licensed_api, public, tor |
| license_class | enum | commercial, open, restricted |
| terms_summary | string | |
| reliability | enum | Admiralty A-F |
| default_confidence | enum | low/medium/high |
| auth_required | boolean | |
| enabled | boolean | default true |
| last_ingested_date | datetime | |
| ingest_count | number | |
| last_error | string | |
| notes | string | |

### IntelligenceReport
| Field | Type | Notes |
| --- | --- | --- |
| title | string | required |
| source_id | string | |
| published_date | datetime | |
| summary | string | |
| url | uri | |
| actor_ids | string | comma-separated |
| campaign_ids | string | comma-separated |
| confidence | enum | |
| reliability | enum | |
| notes | string | |

### Indicator
| Field | Type | Notes |
| --- | --- | --- |
| value | string | required |
| ioc_type | enum | ip, domain, url, hash, email, other |
| kind | enum | payload_delivery, c2, credential_exposure, other |
| actor_ids | string | comma-separated |
| campaign_ids | string | comma-separated |
| malware_ids | string | comma-separated |
| first_seen | datetime | |
| last_seen | datetime | |
| confidence | enum | |
| reliability | enum | |
| source_ids | string | comma-separated |
| fingerprint | string | |
| notes | string | |

### ActorIndicator
| Field | Type | Notes |
| --- | --- | --- |
| actor_id | string | required |
| indicator_id | string | required |
| relationship | enum | uses, targets, communicates_with, attributed_to |
| confidence | enum | |
| notes | string | |

### ActorTechnique
| Field | Type | Notes |
| --- | --- | --- |
| actor_id | string | required |
| technique_id | string | required, MITRE ATT&CK ID |
| technique_name | string | |
| first_seen | datetime | |
| last_seen | datetime | |
| source_ids | string | comma-separated |
| notes | string | |

## Tenant intelligence models (all carry organizationId)

### TenantWatchlist
| Field | Type | Notes |
| --- | --- | --- |
| name | string | required |
| organizationId | string | required |
| kind | enum | domain, keyword, email, identity |
| terms | string | comma- or newline-separated |
| enabled | boolean | default true |
| owner_name | string | |
| notes | string | |

### ExposureFinding
| Field | Type | Notes |
| --- | --- | --- |
| organizationId | string | required |
| watchlist_id | string | |
| kind | enum | credential_leak, mention, domain_exposure, identity_exposure |
| severity | enum | Critical, High, Medium, Low |
| title | string | |
| summary | string | |
| affected_identity | string | masked |
| credential_sample | string | masked (first2 + last2) |
| credential_hash | string | SHA-256 fingerprint |
| source_id | string | |
| source_url | uri | |
| retrieved_at | datetime | |
| published_at | datetime | |
| first_seen | datetime | |
| last_seen | datetime | |
| confidence | enum | |
| reliability | enum | |
| attribution_status | enum | |
| fingerprint | string | |
| terms_class | enum | commercial, open, restricted |
| status | enum | new, validated, false_positive, remediated |
| assigned_to | string | |
| validation_notes | string | |
| retention_expires | datetime | |
| notes | string | |

### ExposureEvidence
| Field | Type | Notes |
| --- | --- | --- |
| finding_id | string | required |
| organizationId | string | required |
| source_id | string | |
| captured_date | datetime | |
| published_date | datetime | |
| content_excerpt | string | masked, analyst-approved |
| fingerprint | string | |
| content_hash | string | SHA-256 |
| terms_class | enum | commercial, open, restricted |
| revealed | boolean | default false |
| reveal_expires | datetime | |
| reveal_audit | string | append user + timestamp per reveal |
| retention_expires | datetime | |
| notes | string | |

### IntelligenceCase
| Field | Type | Notes |
| --- | --- | --- |
| organizationId | string | required |
| title | string | required |
| status | enum | open, in_progress, closed, false_positive |
| severity | enum | Critical, High, Medium, Low |
| actor_ids | string | comma-separated |
| exposure_finding_ids | string | comma-separated |
| threat_ids | string | comma-separated (links to existing Threat) |
| assigned_to | string | |
| due_date | date | |
| summary | string | |
| notes | string | |

## Sensitive-data handling (enforced on write)

Never persist: plaintext passwords, session tokens, private keys, full payment
data, complete identity records.
Store: masked samples, hashes/fingerprints, source metadata, timestamps,
analyst-approved excerpts.

Credential masking: keep first 2 + last 2 characters with a fixed mask for the
middle, plus a SHA-256 fingerprint for exact-match dedup. The full value is
never stored.

## Provenance (required on ExposureFinding, ExposureEvidence, Indicator)

source_id, retrieved_at, published_at, confidence, reliability, fingerprint,
terms_class, retention_expires, validation_status.

## RBAC permissions (target)

intel.read, intel.manage, darkweb.read, darkweb.manage, exposures.reveal,
watchlists.manage, intel.sources.manage.

MVP role mapping (until granular scopes ship): read = authenticated;
manage = admin/superadmin; analyst validation of ExposureFinding.status
permitted for analyst/admin/superadmin.

## APIs (target)

Platform: GET/POST /api/intel/sources, /api/intel/actors, /api/intel/campaigns,
/api/intel/malware, /api/intel/indicators, /api/intel/reports,
/api/intel/sources/:id/health.

Tenant: GET/POST /api/tenants/watchlists;
GET/POST /api/exposures/findings, /api/exposures/findings/:id/validate,
/api/exposures/findings/:id/reveal;
GET/POST /api/exposures/evidence, /api/exposures/evidence/:id/reveal;
GET/POST /api/intel/cases.

All list endpoints support search, kind, sort, limit. Tenant endpoints enforce
organizationId server-side.
