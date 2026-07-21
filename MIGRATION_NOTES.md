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
