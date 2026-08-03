# Feature Port Packet — #1: Dark-Web & Threat-Actor Intelligence

This is the source-of-truth spec for porting the Dark-Web & Threat-Actor Intelligence feature
from the ThreatPulse SaaS builder into the self-hosted Docker stack.

## Frontend Files (port directly)

These files live in the SaaS app and should be replicated into the self-hosted repo,
preserving imports/paths:

- `src/pages/ThreatActors.jsx` — the intel panel UI (list, filters, stat row, collect-now trigger)
- `src/components/threats/ThreatActorTrends.jsx` — trend / origin visualization (Recharts)
- `src/components/DarkWebShowcase.jsx` — the pricing-page flagship showcase section
- `src/components/SeverityBadge.jsx`, `src/components/StatusBadge.jsx` — shared badge atoms (if referenced)

### Notes
- UI is React + Tailwind. Icon library: `lucide-react`. Charts: `recharts`.
- The page calls `base44.entities.ThreatActor.list(...)` and
  `base44.functions.invoke("ingestThreatActors", {})` — swap these for your
  self-hosted API client / fetch calls (see contract below).

## Backend Contract (your stack must provide)

### Entity / Table: `ThreatActor`

| Field              | Type      | Notes                                                        |
| ------------------ | --------- | ------------------------------------------------------------ |
| `name`             | string    | Threat actor / malware family / campaign name (required)     |
| `aliases`          | string    | Alternate names                                              |
| `kind`             | enum      | `threat_actor` \| `malware` \| `campaign` \| `darkweb_mention` \| `indicator` (default `indicator`) |
| `ioc_value`        | string    | Indicator of compromise (IP, domain, URL, hash, email, etc.)|
| `ioc_type`         | string    | e.g. `onion_leak_site`, `victim_domain`                      |
| `threat_type`      | string    | e.g. `ransomware_group`, `ransomware_leak`, `payload_delivery`|
| `confidence`       | enum      | `low` \| `medium` \| `high` (default `medium`)               |
| `malware_printable`| string    | Display name for malware                                     |
| `first_seen`       | datetime  | ISO-8601                                                     |
| `last_seen`        | datetime  | ISO-8601                                                     |
| `source`           | string    | e.g. `Ransomware.live` (required)                            |
| `source_url`       | uri       | Link back to source                                          |
| `tags`             | string    | Comma-separated (e.g. MITRE TTP names)                       |
| `reporter`         | string    | Reporting source / group                                     |
| `notes`            | string    | Free-text description                                        |

Built-ins (omit on create): `id`, `created_date`, `updated_date`, `created_by_id`.

### Endpoints

1. `GET /api/threat-actors`
   - Query params: `search` (matches name/ioc_value/malware_printable/tags/aliases),
     `kind` (filter), `limit`, `sort` (`-created_date`).
   - Returns array of `ThreatActor` records.

2. `POST /api/threat-actors/ingest` (admin-only)
   - No body required. Pulls from Ransomware.live, dedups, bulk-inserts.
   - Response shape:
     ```json
     {
       "fetched": { "victims": <int>, "groups": <int> },
       "created": <int>,
       "skipped": <int>,
       "groupsError": "<string|null>"
     }
     ```

### Ingestion Source (free, no API key)

- Recent victims: `https://api.ransomware.live/v2/recentvictims`
- Groups: `https://api.ransomware.live/v2/groups`
- Send header: `User-Agent: ThreatPulse/1.0 (+https://threatpulseintel.com)`
- `Accept: application/json`

### Deduplication Rules

- **Groups** (`kind = threat_actor`): key = `a::<name_lower>`. Skip if seen.
- **Victims** (`kind = darkweb_mention`): key = `v::<victim_lower>::<group_lower>`. Skip if seen.

### Mapping (victims → ThreatActor record)

```
name              = v.group
ioc_value         = v.domain || v.victim
ioc_type          = "victim_domain"
threat_type       = "ransomware_leak"
confidence        = "high"
malware_printable = v.group
first_seen        = v.attackdate
last_seen         = v.discovered
source            = "Ransomware.live"
source_url        = v.url || "https://www.ransomware.live/"
tags              = join([v.activity, v.country], ", ")  (truncated 200)
reporter          = v.group
notes             = v.description (truncated 300)
```

### Mapping (groups → ThreatActor record)

```
name              = g.name
aliases           = g.altname
kind              = "threat_actor"
ioc_value         = first .onion location fqdn, else first location fqdn
ioc_type          = "onion_leak_site" (if onion) else ""
threat_type       = "ransomware_group"
confidence        = "medium"
malware_printable = g.name
first_seen        = g.added_date
source            = "Ransomware.live"
source_url        = g.url || "https://www.ransomware.live/group/<name>"
tags              = join(technique names from g.ttps, ", ") (truncated 200)
reporter          = "Ransomware.live"
notes             = g.description (truncated 300)
```

## Access Control

- `POST /ingest` → admin / superadmin only.
- `GET /list` → any authenticated analyst (read-all).
- Create/Update/Delete on records → admin / superadmin only.

## Pricing Placement (SaaS)

The `DarkWebShowcase` component is rendered on the Pricing page between the
tier cards and the Self-Hosted section, positioned as the flagship capability
with a Free-vs-Enterprise comparison and an intel-source icon strip.