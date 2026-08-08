# Port #05: Widget UX Enhancements + Exposure Monitoring Domain

## Overview
This PR integrates two major feature sets from the SaaS reference into the Docker stack:

### 1. Widget UX Enhancements (Advanced Analytics)
- **Composite Risk Leaderboard** — ranks all threats by a 0-100 composite score (CVSS + EPSS + KEV + exploit availability + severity floor)
- **Risk Scatter Plot** — EPSS x CVSS visualization with quadrant highlighting for high-priority threats
- **CVE to Product Correlation Matrix** — maps CVEs to affected products with blast-radius heat map
- **Threat Correlation Clusters** — connected-component clustering by shared CVEs, products, ATT&CK techniques, and campaigns

**New files:**
- `nextjs_space/lib/risk-analytics.ts` — composite risk scoring + CVE-product correlation
- `nextjs_space/lib/threat-correlation.ts` — correlation graph, clustering, cluster summarization
- `nextjs_space/app/(app)/analytics/page.tsx` — new /analytics route
- `nextjs_space/app/(app)/analytics/_components/` — leaderboard, scatter plot, matrix, cluster card

### 2. Exposure Monitoring Domain
Full credential-exposure and dark-web mention monitoring with evidence-reveal workflow.

**Prisma models (4 new):**
- `ExposureFinding` — credential leaks, mentions, domain/identity exposures
- `ExposureEvidence` — masked evidence with time-limited reveal + audit log
- `TenantWatchlist` — monitored domains/keywords/emails/identities
- `IntelligenceSource` — registered intelligence feed metadata

**API routes:**
- `GET/POST /api/exposure/findings` — list + create findings
- `GET/PATCH /api/exposure/findings/[id]` — detail + status/assignment updates
- `GET /api/exposure/findings/[id]/evidence` — list evidence for a finding
- `PATCH /api/exposure/findings/[id]/evidence/[evidenceId]` — reveal evidence (audit-logged)
- `GET/POST/DELETE /api/exposure/watchlists` — watchlist CRUD

**UI pages:**
- `/exposure` — findings list with stats, filters, search
- `/exposure/watchlists` — watchlist CRUD with term management
- `/exposure/[id]` — finding detail with evidence reveal, status workflow, assignment

### 3. Sidebar Navigation
Added two new nav sections to `app-sidebar.tsx`:
- **Risk and Portfolio** -> Advanced Analytics (new)
- **Exposure Monitoring** -> Findings, Watchlists (new)

## Deployment Notes
1. The Prisma schema includes 4 new models. Run `prisma db push` (or let the Docker entrypoint handle it automatically).
2. A SQL migration is included at `prisma/migrations/20260808120000_add_exposure_domain/`.
3. No environment variables or secrets are required — all data is stored in the existing Postgres instance.