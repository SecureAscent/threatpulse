# Migration Notes — Security & Admin Hardening

This release adds MFA/TOTP, password reset, API keys, session management, and rate
limiting to ThreatPulse. It introduces **new Prisma models and one new column**, so a
database migration is required before the app will run.

> These commands were **not** run for you — migrations must be applied on the server
> that owns the database. Run them from the `nextjs_space/` directory.

---

## 1. Prisma migration (required)

The Prisma schema (`nextjs_space/prisma/schema.prisma`) changed as follows:

- **`Organization.setupCompleted`** — new `Boolean @default(false)` column.
- **`MfaSecret`** — TOTP secret, verified flag, and SHA-256 hashes of backup codes (one per user).
- **`PasswordResetToken`** — hashed, single-use, time-limited reset tokens.
- **`ApiKey`** — org-scoped API keys (prefix stored in clear for display, full key stored only as a SHA-256 hash), scopes, expiry, and revocation.
- **`ActiveSession`** — per-device session records for the "active sessions" UI and remote sign-out.
- **`AuditLog`** — security audit trail (MFA changes, key create/revoke, session revoke, password reset, setup completion).

### On your server

```bash
cd nextjs_space

# Generate the Prisma client (safe to run repeatedly)
npx prisma generate

# Create and apply the migration against your database
npx prisma migrate dev --name security_hardening
```

For a **production** deployment, generate the migration once in a dev/staging
environment with `prisma migrate dev`, commit the generated files under
`prisma/migrations/`, then apply them on production with:

```bash
npx prisma migrate deploy
```

> `npx prisma generate` has already been run locally so the app typechecks, but **no
> migration was created or applied** — the database is untouched. `setupCompleted`
> defaults to `false`, so existing organizations will show the setup checklist banner
> until an admin marks setup complete.

---

## 2. Environment variables

No new **required** variables. Two existing/optional variables affect behavior:

- **`NEXTAUTH_URL`** (recommended) — used to build the absolute password-reset link.
  Falls back to `NEXT_PUBLIC_APP_URL`, then to a relative path.
- Email delivery for password resets is **not** wired to a provider in this change.
  The reset link is written to the **server logs** (`console`). Integrate your existing
  email/notification transport in `app/api/auth/forgot-password/route.ts` where the
  link is logged. The token itself is already hashed and stored correctly.

---

## 3. Behavioral notes & known limitations

- **Rate limiting is in-memory** (`lib/rate-limit.ts`): a sliding window that protects
  `forgot-password` and `reset-password` (5 requests/hour/IP). It resets on process
  restart and is **per-instance** — if you run multiple app replicas, move this to a
  shared store (e.g. Redis) for cluster-wide limits.

- **API-key authentication runs in route handlers, not middleware.** Next.js edge
  middleware cannot use Prisma, so `getTenantContext(req)` (Node runtime) resolves an
  `Authorization: Bearer tp_live_...` key inside each route. Middleware still protects
  page routes via NextAuth and adds security headers.

- **Session revocation is advisory.** The app uses NextAuth JWT sessions, so the
  `ActiveSession` table tracks devices and supports "sign out this / other devices" at
  the record level. Because the JWT itself is stateless, a revoked device is fully cut
  off on its next session-validated action / token refresh rather than instantly. The
  login form registers a session record after each successful sign-in.

- **MFA backup codes** are shown **once** at enable time and stored only as SHA-256
  hashes. Each code is single-use. Admins can disable another user's MFA for account
  recovery (audited); self-disable requires the current password.

- **TOTP library:** `otplib@^12` (classic `authenticator` API) plus `qrcode` for the
  enrollment QR. These are declared in `nextjs_space/package.json`; run
  `yarn install` (or `npm install`) on the server if your node_modules are not vendored.

---

## 4. Post-migration smoke test

1. `yarn install && npx prisma migrate dev --name security_hardening` (or `migrate deploy`).
2. Start the app and sign in.
3. Visit **Settings → Security**: enable 2FA (scan QR, verify code, download backup codes).
4. Sign out and back in — confirm the TOTP step appears and a backup code also works.
5. Visit **Admin → API Keys**: create a key, copy it once, call the API with
   `Authorization: Bearer <key>`, then revoke it.
6. Visit **Admin → Setup Checklist** (as SUPERADMIN) and mark setup complete — the
   dashboard banner should disappear.
7. Test **Forgot password** → check server logs for the reset link → complete the reset.


---

# Migration Notes — Analyst Workflow

This release adds an analyst workflow layer on top of the threat catalog: threat notes,
assignment, a full status lifecycle with history, saved filters, and bulk actions. It
introduces **new Prisma models and new columns on `Threat`**, so a database migration is
required before the app will run.

> These commands were **not** run for you — migrations must be applied on the server that
> owns the database. Run them from the `nextjs_space/` directory.

---

## 1. Prisma migration (required)

The Prisma schema (`nextjs_space/prisma/schema.prisma`) changed as follows:

### New models

- **`ThreatNote`** — analyst notes on a threat (`threatId`, `authorId`, `content`,
  `isInternal` flag, timestamps). Cascade-deletes with its threat. `isInternal` notes are
  hidden from `VIEWER` role.
- **`ThreatStatusHistory`** — append-only audit of status transitions (`threatId`,
  `changedById`, `fromStatus`, `toStatus`, optional `note`, `createdAt`). Cascade-deletes
  with its threat. One row is written on every status change (single threat or bulk).
- **`SavedFilter`** — reusable threat-list filters (`userId`, `organizationId`, `name`,
  `filters` JSON, `isShared`). Cascade-deletes with its user and organization. Shared
  filters are visible to the whole organization.

### New columns on `Threat`

- **`assignedToId`** (`String?`) + **`assignedTo`** relation (`ThreatAssignedTo`) — analyst
  the threat is assigned to.
- **`dueDate`** (`DateTime?`) — remediation due date; drives the "overdue" indicators.
- **`tags`** (`String[]`) — free-form labels for triage/filtering.
- Back-relations **`notes`** and **`statusHistory`**, plus indexes on `assignedToId` and
  `status`.

New back-relations were also added to **`User`** (`threatNotes`, `assignedThreats`,
`statusChanges`, `savedFilters`) and **`Organization`** (`savedFilters`).

### Status lifecycle

The workflow status set is now:
`NEW → UNDER_REVIEW → ACTION_REQUIRED → IN_PROGRESS → MITIGATED → ACCEPTED_RISK → NOT_RELEVANT`.
The legacy `INVESTIGATING` and `RESOLVED` values are **not** used by new UI but still render
correctly (the status helper degrades gracefully for unknown values), so existing rows do
not need to be backfilled.

### On your server

```bash
cd nextjs_space

# Generate the Prisma client (safe to run repeatedly)
npx prisma generate

# Apply the schema. This project uses `db push` (no migrations folder committed):
npx prisma db push
```

> `npx prisma generate` has already been run locally so the app typechecks, but **no
> schema change was pushed** — the database is untouched. All new columns are nullable or
> have defaults (`tags` defaults to empty), so existing `Threat` rows migrate cleanly with
> no backfill.

---

## 2. Environment variables

No new environment variables are required for this change.

---

## 3. New API routes

- `GET/POST /api/threats/[id]/notes`, `DELETE /api/threats/[id]/notes/[noteId]` — threat notes.
- `PATCH /api/threats/[id]/assign` — assign/unassign a threat (validates same-organization analyst).
- `GET /api/org/analysts` — organization analyst roster for assignment dropdowns.
- `GET/POST /api/saved-filters`, `DELETE /api/saved-filters/[id]` — saved threat filters.
- `POST /api/threats/bulk` — bulk status / assignment / due-date / tag actions.
- `PATCH /api/threats/[id]` — now also accepts `status` (+ optional `statusNote`, writing a
  `ThreatStatusHistory` row inside a transaction), `assignedToId`, `dueDate`, and `tags`.
- `GET /api/threats` — supports `assignedTo` (`me` / `unassigned` / user id) and `tag` params.
- `GET /api/dashboard` — now returns an `actionRequired` summary (counts + top items) for the
  dashboard workflow widget.

All routes enforce `threats.read` / `threats.manage` permissions via `getTenantContext`, and
mutations write audit events. `VIEWER` cannot manage; `ANALYST` and above can.

---

## 4. Post-migration smoke test

1. `npx prisma generate && npx prisma db push`.
2. Start the app and open **Threats**: try the quick-filter pills (Action Required, Mine,
   Unassigned, Overdue), save a filter, and run a bulk status/assignment action.
3. Open a threat detail: change status (with a note), assign an analyst, set a due date, add
   tags, and add both a public and an internal note.
4. Confirm the status timeline shows the transitions and the **Dashboard → Action Required**
   widget reflects the open/overdue/unassigned counts.
5. Open **Actioned Threats** and export the CSV.



---

# Migration Notes — Intelligence Engine

This release adds the threat intelligence engine: a composite **0–100 risk score**,
**EPSS** enrichment (FIRST.org), **CISA KEV** flagging, **MITRE ATT&CK** technique
tagging, source **deduplication**, and a **collector health dashboard**. It introduces
**new columns on `Threat`** and **one new model (`CollectorRun`)**, so a database
schema push is required before the app will run.

> These commands were **not** run for you — apply them on the server that owns the
> database. Run them from the `nextjs_space/` directory.

---

## 1. Prisma schema changes (required)

The Prisma schema (`nextjs_space/prisma/schema.prisma`) changed as follows:

### New columns on `Threat`

All are nullable or have defaults, so existing rows migrate cleanly with **no backfill**:

- **`riskScore`** (`Float?`) — composite 0–100 ThreatPulse risk score.
- **`epssScore`** (`Float?`) — EPSS exploit probability (0–1).
- **`epssPercentile`** (`Float?`) — EPSS percentile (0–1).
- **`epssUpdatedAt`** (`DateTime?`) — last time EPSS was fetched for this threat.
- **`isKev`** (`Boolean @default(false)`) — present in the CISA Known Exploited Vulnerabilities catalog.
- **`exploitAvailable`** (`Boolean @default(false)`) — a public exploit is known to exist.
- **`mitreAttackIds`** (`String[]`) — inferred MITRE ATT&CK technique ids (e.g. `T1190`).
- **`sourceUrls`** (`String[]`) — every source URL that reported this threat (grows on dedup merge).
- **`dedupKey`** (`String?`) — normalized key (usually the upper-cased CVE id) used to detect duplicates.
- **`duplicateOf`** (`String?`) — set on a record that was merged into an existing threat.
- **`enrichedAt`** (`DateTime?`) — last time the enrichment job processed this threat.

New indexes on `Threat`: `@@index([dedupKey])`, `@@index([riskScore])`, `@@index([isKev])`.

### New model

- **`CollectorRun`** — one row per collector source per cycle, powering the collector
  health dashboard: `source`, `status` (`running` / `success` / `error`), `startedAt`,
  `completedAt`, `itemsFound`, `itemsNew`, `itemsUpdated`, `itemsSkipped`, `errorMessage`,
  `durationMs`. Indexed on `source`, `status`, and `startedAt`.

### On your server

```bash
cd nextjs_space

# Generate the Prisma client (safe to run repeatedly)
npx prisma generate

# Apply the schema. This project uses `db push` (no migrations folder committed);
# the docker entrypoint already runs `prisma db push` on container start.
npx prisma db push
```

> `npx prisma generate` has already been run locally so the app typechecks, but **no
> schema change was pushed** — the database is untouched. Because the app's Docker
> entrypoint (`docker/docker-entrypoint.sh`) runs `prisma db push` on startup, a normal
> container redeploy applies these columns automatically.

---

## 2. Backfill existing threats (recommended)

New columns start empty, so existing threats have no risk score or enrichment until you
run the one-time jobs. Both are exposed as admin endpoints and as buttons on the new
**Admin → Collector Health** page:

- **Enrich** (`POST /api/admin/enrich`, SUPERADMIN) — fetches EPSS, infers MITRE ATT&CK
  ids, flags KEV, and computes the risk score. Body: `{ limit?, onlyMissing? }`
  (`onlyMissing` defaults to `true`). EPSS is fetched from FIRST.org in batches of 100
  and **fails soft** (missing EPSS never blocks enrichment).
- **Recalculate scores** (`POST /api/admin/recalculate-scores`, SUPERADMIN) — recomputes
  `riskScore` for every threat from currently stored intelligence, no external calls.

New threats created via `POST /api/threats` are **auto-enriched and deduplicated** on
insert, so the backfill is only needed once for the pre-existing catalog.

---

## 3. Environment variables

No new **required** variables. New **optional** variables control the collector's
control server (used by the "Run Now" buttons on the health dashboard):

| Variable | Side | Default | Purpose |
| --- | --- | --- | --- |
| `COLLECTOR_CONTROL_PORT` | collector | `9464` | Port for the collector's lightweight HTTP control server. |
| `COLLECTOR_CONTROL_TOKEN` | collector + app | *(unset)* | Optional shared secret; if set, the app sends it as `x-collector-token` and the collector requires it. |
| `COLLECTOR_CONTROL_URL` | app | `http://collector:9464` | Base URL the app uses to reach the collector over the internal Docker network. |
| `COLLECTOR_INTERVAL_MINUTES` | app + collector | `15` | Collection interval; the dashboard uses it to estimate the next run. |

If the collector is not running, the "Run Now" buttons fail soft with a friendly 502 —
the rest of the dashboard (read from `CollectorRun`) still works.

---

## 4. New API routes & pages

- `GET /api/admin/collector-health` (ADMIN+) — latest run per source, 24h rollup, catalog totals.
- `POST /api/admin/collector-health/trigger` (ADMIN+) — asks the collector to run now (optional `source`).
- `POST /api/admin/enrich` (SUPERADMIN) — EPSS + MITRE + KEV + risk enrichment.
- `POST /api/admin/recalculate-scores` (SUPERADMIN) — recompute all risk scores.
- `POST /api/threats` — now dedup-checks (returns `{ duplicate: true, existingId }` and
  merges the source URL) and auto-enriches on create.
- `GET /api/dashboard` — now returns a `riskInsights` block (avg score, KEV count, top 5 by risk).
- **Admin → Collector Health** page (`/admin/collector-health`) — source status cards,
  "Run Now" / "Enrich" / "Recalculate" actions, and an overall health summary
  (auto-refreshes every 60s). Added to the admin sidebar along with "Enrich Threats" and
  "Recalculate Scores".

Risk score, KEV, EPSS, and MITRE ATT&CK ids are now surfaced on the **threats list**,
**threat detail**, and **dashboard**.

---

## 5. Collector changes

The collector (`collector/src/`) now records a `CollectorRun` row per source per cycle
and exposes a tiny HTTP control server (`collector/src/control.ts`) with `GET /health`
and `POST /run?source=`. The DB helpers are fail-soft: if `CollectorRun` writes fail,
collection still proceeds. Run `npm install` in `collector/` if node_modules are not
vendored (no new runtime dependencies were added).

---

## 6. Post-migration smoke test

1. `npx prisma generate && npx prisma db push`.
2. Redeploy the collector and app (or `npm install` + restart locally).
3. As SUPERADMIN, open **Admin → Collector Health**, click **Enrich Threats**, then
   **Recalculate Scores**; confirm the toast reports counts.
4. Open **Threats**: sort by Risk Score, confirm 0–100 badges, KEV pills, and EPSS %.
5. Open a threat detail: confirm the risk badge, KEV/exploit pills, EPSS row, and
   linked MITRE ATT&CK technique badges.
6. Open the **Dashboard**: confirm the "Highest Risk Threats" widget (avg score, KEV
   count, top 5).
7. Back on **Collector Health**, click **Run Now** on a source and confirm a new run
   appears (or a friendly error if the collector is offline).
