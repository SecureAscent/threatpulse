# Intelligence Collector

The collector (`collector/`) is a standalone Node.js worker that automatically ingests threat intelligence into the same PostgreSQL database the app uses. It connects **directly with `pg`** (no Prisma runtime) and writes into the Prisma-managed `"Threat"` table.

## How it runs

- On boot it runs one collection cycle immediately, then repeats on a cron schedule (`*/N * * * *`, default every 15 min).
- Set `RUN_ONCE=true` to run a single cycle and exit (used by tests / manual runs).
- Cycles never overlap — if one is still running when the next tick fires, the tick is skipped.
- Graceful shutdown on `SIGTERM`/`SIGINT` (closes the connection pool).

## Sources

| Source | Type | Endpoint | Notes |
|--------|------|----------|-------|
| CISA KEV | `CVE` | `known_exploited_vulnerabilities.json` | Newest first, capped at `KEV_LIMIT`. Ransomware-linked ⇒ `CRITICAL`, else `HIGH`. |
| NVD | `CVE` | `services.nvd.nist.gov/rest/json/cves/2.0` | CVEs modified in the last `NVD_LOOKBACK_DAYS`, paginated. CVSS → severity. |
| RSS (×11) | `NEWS` | US-CERT, CISA Alerts, Krebs, Bleeping Computer, Dark Reading, SANS ISC, Threatpost, SecurityWeek, Recorded Future, Unit 42, Talos | Severity inferred from keywords. |

## Data mapping

Every record is upserted keyed on the unique `threatId`:

- **KEV / NVD** → `threatId = CVE-ID` (so the same CVE from both sources dedupes to one row).
- **RSS** → `threatId = "NEWS-" + sha1(guid|link)` (stable, so re-collection updates rather than duplicates). The article link is stored in `indicators`.

On conflict, intelligence fields (title, severity, description, cvssScore, …) are refreshed but the analyst workflow **`status` (NEW / INVESTIGATING / RESOLVED) is preserved** — collection never clobbers triage state.

Threats are attached to the organization resolved from `COLLECTOR_ORG_SLUG` (default `threatpulse-demo`), falling back to the oldest organization. If no organization exists yet, the cycle is skipped and retried next tick.

## Configuration (env vars)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — (required) | Postgres connection string |
| `COLLECTOR_INTERVAL_MINUTES` | `15` | Cron interval |
| `COLLECTOR_ORG_SLUG` | `threatpulse-demo` | Target organization |
| `RUN_ONCE` | `false` | Run one cycle then exit |
| `COLLECT_KEV` / `COLLECT_NVD` / `COLLECT_RSS` | `true` | Toggle individual sources |
| `KEV_LIMIT` | `150` | Max KEV entries per run |
| `NVD_API_KEY` | — | Higher NVD rate limits |
| `NVD_LOOKBACK_DAYS` | `2` | NVD modification window |
| `NVD_MAX_PAGES` | `5` | Max NVD pages per run |
| `RSS_PER_FEED_LIMIT` | `25` | Items kept per feed per run |
| `LOG_LEVEL` | `info` | Set `debug` for verbose logs |

## Local development

```bash
cd collector
npm install
npm run typecheck        # tsc --noEmit
DATABASE_URL=... npm run run-once   # single cycle against a local DB
npm run dev              # watch mode (tsx)
```

Within the Docker stack: `docker compose -f docker-compose.prod.yml logs -f collector`.

## Adding a feed

Edit `collector/src/sources/rss.ts` and append to `RSS_FEEDS`:

```ts
{ name: 'My Feed', url: 'https://example.com/rss.xml' },
```

Rebuild the collector image: `docker compose -f docker-compose.prod.yml up -d --build collector`.
