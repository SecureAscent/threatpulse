# Port Packet 03 — Retention System + MITRE ATT&CK + EPSS Enrichment

Bundles all ThreatPulse SaaS changes since the last port into the self-hosted Docker stack.

## What is in this packet

1. **Tiered data retention** — 30-day rolling window for news/RSS, 90-day for CVEs/CISA KEV, with a nightly archival sweep that preserves unresolved Critical/High threats.
2. **MITRE ATT&CK technique mapping** — AI-assisted enrichment that suggests canonical ATT&CK technique IDs/names/tactics for any threat or threat actor, persisted as a compact JSON string.
3. **EPSS enrichment** — feed ingestion now pulls FIRST.org EPSS exploit-prediction scores (probability + percentile) for every CVE, enabling risk-based vulnerability prioritization.
4. **Sliding trend windows** — dashboard trend charts gain 7D / 30D / 90D selectors aligned to the 90-day hot retention window.
5. **Retention health UI** — a Feeds-page panel showing active vs. archived counts and a manual "Run archival now" trigger.

## Threat entity — schema delta

Add these fields to the `Threat` table (full schema in `backend/entities/Threat.jsonc`):

| Field | Type | Notes |
|---|---|---|
| `epss_score` | number (0-1) | FIRST.org EPSS probability — likelihood of exploitation in next 30 days |
| `epss_percentile` | number (0-1) | Percentile rank of the EPSS score across all scored CVEs |
| `attack_techniques` | string (JSON) | `[{"id":"T1566","name":"Phishing","tactic":"Initial Access"}, ...]` from AI mapping |
| `retention_class` | enum `short` \| `standard` | `short` = 30-day (news/RSS), `standard` = 90-day (CVEs/CISA KEV). Assigned at ingest. |
| `archived` | boolean | `true` once the nightly sweep archived the record out of the active window |
| `sla_alert_sent` | boolean | `true` once an SLA-breach alert was emailed for this threat |

Built-ins (omit on create): `id`, `created_date`, `updated_date`, `created_by_id`.

## Backend contracts (your stack must provide)

### POST /api/threats/enrich-attack  (admin/superadmin only)
- Body: `{ "threat_id": "<id>" }` or `{ "actor_id": "<id>" }`.
- Reads the record, builds a prompt from title/description/affected_products/etc., calls your LLM with a JSON schema returning `techniques[]` of `{id,name,tactic}`.
- Validates IDs against `^T\d{4}(\.\d{3})?$`, persists as JSON string in `attack_techniques`.
- Returns `{ status, entity, id, techniques, attack_techniques }`.
- Reference impl: `backend/functions/enrichAttackTechniques/entry.ts`.

### POST /api/threats/archive-stale  (admin/superadmin only)
- For each non-archived threat, compute age vs. `retention_class` window (30/90 days).
- Skip (preserve) unresolved Critical/High threats past their window.
- Bulk-set `archived = true` on the rest.
- Returns `{ status, scanned, archived, skipped_critical_unresolved }`.
- Reference impl: `backend/functions/archiveStaleThreats/entry.ts`.

### POST /api/threats/ingest  (authenticated)
- Body: `{ "source": "all"|"cisa"|"nvd"|"rss", "limit": 25, "days": 7 }`.
- Pulls CISA KEV + NVD (recent CVEs) + 18 RSS news feeds, dedups, bulk-inserts.
- **NEW:** after building candidates, batch-query FIRST.org EPSS (`https://api.first.org/data/v1/epss?cve=CVE-1,CVE-2,...`, up to 100 per request) and attach `epss_score` + `epss_percentile` to each CVE candidate before insert.
- Assigns `retention_class`: `standard` for NVD/CISA KEV, `short` for RSS news.
- Returns `{ status, source, fetched, duplicates, created, feeds[] }`.
- Reference impl: `backend/functions/ingestFeeds/entry.ts` (see `fetchEpssBatch`).

### Scheduled job: Nightly Threat Archival
- Cron: `0 2 * * *` (02:00 America/Chicago), recurring.
- Calls the archive-stale endpoint above.
- Definition: `backend/workflows/nightly-threat-archival.jsonc`.

## FIRST.org EPSS API (free, no key)
- Endpoint: `GET https://api.first.org/data/v1/epss?cve=<CVE>,<CVE>,...` (up to 100 CVEs comma-joined).
- Headers: `Accept: application/json`.
- Response: `{ data: [{ cve, epss, percentile }, ...] }` — `epss` and `percentile` are strings; `parseFloat` them.
- Best-effort: swallow per-batch errors so one failed batch does not abort ingestion.

## Frontend files (port directly, preserve import paths)

| SaaS path | Self-hosted target | Notes |
|---|---|---|
| `src/components/AttckTechniques.jsx` | `src/components/AttckTechniques.jsx` | ATT&CK panel + "Auto-map" button; calls `enrichAttackTechniques` |
| `src/components/RetentionHealth.jsx` | `src/components/RetentionHealth.jsx` | Retention stats + manual archival trigger; calls `archiveStaleThreats` |
| `src/components/ThreatTrendCharts.jsx` | `src/components/ThreatTrendCharts.jsx` | 7D/30D/90D window toggle (Recharts) |
| `src/pages/ThreatDetail.jsx` | `src/pages/ThreatDetail.jsx` | Wired ATT&CK panel + EPSS in header/metadata |
| `src/pages/Feeds.jsx` | `src/pages/Feeds.jsx` | Renders `<RetentionHealth />` above the feed controls |

### Notes
- UI is React + Tailwind. Icons: `lucide-react`. Charts: `recharts`. Data layer: `@tanstack/react-query`.
- Swap `base44.entities.*` / `base44.functions.invoke(...)` calls for your self-hosted API client.
- `AttckTechniques` reads `threat.attack_techniques` (JSON string, or legacy comma-separated IDs) and renders links to `https://attack.mitre.org/techniques/<id>`.

## Access control
- `enrich-attack` + `archive-stale` → admin / superadmin only.
- `ingest` → any authenticated analyst.
- Reads → any authenticated analyst (read-all).

## Acceptance checklist
- [ ] `Threat` table migrated with the 5 new fields.
- [ ] `enrichAttackTechniques` endpoint returns mapped techniques and persists them.
- [ ] `archiveStaleThreats` endpoint archives past-window threats, preserves unresolved Critical/High.
- [ ] `ingestFeeds` attaches EPSS scores to new CVEs.
- [ ] Nightly archival cron scheduled.
- [ ] ATT&CK panel renders on threat detail with working Auto-map.
- [ ] Retention Health panel renders on Feeds page with working manual trigger.
- [ ] Trend charts offer 7D/30D/90D and reflect archived-filtering.