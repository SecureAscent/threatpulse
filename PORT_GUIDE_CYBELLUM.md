# Feature Port Packet — Cybellum Per-Tenant Integration (SBOM / VRM Sync)

This is the source-of-truth spec for porting the per-tenant Cybellum integration from the
ThreatPulse SaaS builder into the self-hosted Docker stack. It mirrors the existing
per-tenant pattern used for Confluence and Jira: each organization stores its own Cybellum
credentials in a dedicated connection entity — no global app secret.

## Frontend Files (port directly)

These files live in the SaaS app and should be replicated into the self-hosted repo,
preserving imports/paths:

- `src/components/integrations/CybellumSetup.jsx` — the per-tenant setup panel (add / edit /
  test / enable-disable / delete connections, plus a "Sync now" trigger with a live summary)
- `src/pages/Integrations.jsx` — the Integrations dashboard; the Cybellum card is `expandable:
  "cybellum"` and renders `<CybellumSetup />` when expanded. The card is `status: "off"`
  until a connection exists (no live status query in the SaaS version — flip it to active once
  a connection row is present, mirroring how Jira reflects `jiraConnected`).

### Notes
- UI is React + Tailwind. Icon library: `lucide-react`. No charts.
- The component calls:
  - `base44.entities.CybellumConnection.filter({}, "-created_date", 50)` — list this org's
    connections (RLS scopes to org members + admins)
  - `base44.entities.CybellumConnection.create / update / delete` — CRUD
  - `base44.functions.invoke("testCybellumConnection", { base_url, api_token })` — validate
    credentials before saving
  - `base44.functions.invoke("syncCybellum", {})` — pull products / SBOM / findings
- Swap these for your self-hosted API client / fetch calls (see contract below).
- Auth gate: `base44.auth.isAuthenticated()` → `base44.auth.me()` to get `user.data.organization_id`.
  A connection requires `organization_id`; show a warning if the user has no org.

## Backend Contract (your stack must provide)

### Entity / Table: `CybellumConnection`

| Field                | Type      | Notes                                                                 |
| ------------------- | --------- | --------------------------------------------------------------------- |
| `display_name`      | string    | Friendly label for this Cybellum tenant                               |
| `base_url`          | uri       | Cybellum tenant API base URL, e.g. `https://your-tenant.cybellum.com` (required) |
| `api_token`         | string    | Per-tenant Cybellum API token. **Secret** — only org members + admins can read it (required) |
| `organization_id`   | string    | Tenant scope — the ThreatPulse org this connection belongs to (required) |
| `enabled`           | boolean   | default `true` — disable to pause sync without losing settings        |
| `last_tested_date`  | datetime  | ISO-8601                                                              |
| `last_test_status`  | enum      | `untested` \| `success` \| `failed` (default `untested`)              |
| `last_error`        | string    | Last test/sync error message                                          |
| `last_synced_date`  | datetime  | ISO-8601                                                              |
| `last_sync_summary` | string    | Human-readable summary of the most recent sync run                    |
| `cybellum_user_key` | string    | Account/user identifier returned by a successful connection test    |

**Access control (RLS):**
- `read`: org members (`data.organization_id == user.organization_id`) OR `admin`/`superadmin`
- `create`: `data.organization_id == user.organization_id`
- `update` / `delete`: org members OR `admin`/`superadmin`

In the self-hosted stack, enforce the same with a row-level policy / middleware that compares
the connection's `organization_id` to the requesting user's organization.

### Backend Function: `testCybellumConnection`

**Input:** `{ base_url, api_token }`
**Behavior:**
1. Probe a few likely account/profile paths with `Authorization: Bearer <api_token>`:
   `/api/v1/me`, `/api/v1/account`, `/api/v1/user/me`, `/api/v2/me`, `/api/v2/account`
2. First 2xx → success; 401/403 → "Authentication failed — check your API token";
   404 → try next path; other → record status.
3. On success return `{ status: "success", user_key, display_name, email }`.
4. On failure return `{ status: "failed", error }` (HTTP 200 — the UI reads `status`).

> Cybellum's REST API is tenant-specific and not publicly documented. The probe paths above
> are best-guess defaults — adjust them to your tenant's real account endpoint if known.

### Backend Function: `syncCybellum`

**Input:** `{}` (uses the calling user's organization)
**Behavior:**
1. Resolve the user's organization (from `user.data.organization_id`, else find an org whose
   `members` includes the user). 404 if none.
2. Find the org's **enabled** `CybellumConnection` (newest first). 404 if none — tell the user
   to add one on the Integrations page first.
3. Paginated GET helper (`limit=100`, up to 20 pages, follows `next`/`cursor` links) that tries
   a list of fallback paths per resource kind and stops at the first path that responds:
   - **products:** `/api/v1/assets`, `/api/v1/products`, `/api/v2/assets`
   - **components:** `/api/v1/sbom`, `/api/v1/components`, `/api/v2/sbom`
   - **findings:** `/api/v1/vulnerabilities`, `/api/v1/findings`, `/api/v2/vulnerabilities`
4. **Products → `Product`** (org-scoped, `sbom_enrolled=true`). Defensive field mapping:
   `name`←name/productName/assetName/title, `vendor`←vendor/manufacturer/supplier,
   `current_version`←version/currentVersion/productVersion/firmwareVersion,
   `cpe_vendor`, `cpe_product`, `keywords`←keywords/tags/categories. Upsert by
   `[name, organization_id]`.
5. **Components → `SbomRecord`** (`source='cybellum'`, `status='active'`). Link to product by
   name via a `product_name`→`product_id` map built from the org's products. Upsert by
   `[component_name, component_version, organization_id]`.
6. **Findings → `Threat`** (CVE only). Map severity (critical/high/medium/low),
   `cvss_score`, `cve_id`, `source='Cybellum'`, `in_vrm=true`, `status='New'`. Upsert by
   `[cve_id, source]` (idempotent — re-running sync updates rather than duplicates).
7. Update the connection: `last_synced_date`, `last_sync_summary`
   (`"Synced N products, M SBOM components, K vulnerability findings from Cybellum."`),
   `last_test_status='success'`, clear `last_error`.
8. Return `{ status, organization, products, sbom_components, vulnerability_findings, summary }`.

**Error handling:** 401/403 from Cybellum → throw "Cybellum auth failed — check the API token".
404 on a path → try the next fallback path. Network error → break and try next path.

### Backend Function: `syncAllCybellumConnections` (scheduled)

**Input:** `{}` (service-role — no user session; runs from a cron trigger)
**Behavior:**
1. Load up to 200 **enabled** `CybellumConnection` records (all orgs). Return early if none.
2. For each connection, resolve its `Organization` (by `organization_id`, else by
   `members` containing the connection's `created_by_id`). Skip if the org is gone.
3. Run the **same** sync logic as `syncCybellum` (products → `Product`, components →
   `SbomRecord`, CVE findings → `Threat`) via a shared helper so both the on-demand
   and scheduled paths stay identical. The helper is extracted into a shared module
   (`base44/shared/cybellumSync.ts` in the SaaS app) — replicate it as a single
   service function both the on-demand route and the cron job call.
4. Per connection, update `last_synced_date`, `last_sync_summary`, and on error
   `last_test_status='failed'` + `last_error`.
5. Return `{ status, connections, results: [{ connection_id, organization, ok, summary, error }], totals }`.

> The SaaS version runs this from a Base44 workflow that fires daily at 06:00 CT
> (`Cybellum Scheduled Sync`). For the self-hosted stack, wire the same service function
> to a cron runner (e.g. a Vercel cron route, a node-cron worker, or a systemd timer)
> at the same cadence. The sync is idempotent (upserts), so a missed or double run is safe.

### Frontend invocation contract

| Action        | SaaS call                                              | Self-hosted equivalent                          |
| ------------- | ------------------------------------------------------ | ----------------------------------------------- |
| List conns    | `CybellumConnection.filter({}, "-created_date", 50)`   | `GET /api/integrations/cybellum`                |
| Create        | `CybellumConnection.create(data)`                      | `POST /api/integrations/cybellum`              |
| Update        | `CybellumConnection.update(id, data)`                  | `PATCH /api/integrations/cybellum/:id`          |
| Delete        | `CybellumConnection.delete(id)`                        | `DELETE /api/integrations/cybellum/:id`         |
| Test          | `functions.invoke("testCybellumConnection", {...})`   | `POST /api/integrations/cybellum/test`          |
| Sync now      | `functions.invoke("syncCybellum", {})`                 | `POST /api/integrations/cybellum/sync`         |

## Self-Hosted Implementation Notes

- **Storage:** mirror the Base44 entity as a Prisma model `CybellumConnection` with an
  `organizationId` FK. Store `api_token` encrypted at rest (e.g. via your existing secrets
  helper) — the SaaS version relies on RLS; the self-hosted version should encrypt the column.
- **Routes:** create `nextjs_space/app/api/integrations/cybellum/route.ts` (GET list + POST
  create), `[...cybellum]/route.ts` (PATCH/DELETE by id), `test/route.ts`, and `sync/route.ts`.
  Guard every route with the org-membership middleware used by the Confluence/Jira routes.
- **Sync job:** the SaaS version has both an on-demand "Sync now" button (`syncCybellum`,
  user-scoped) and a daily scheduled sweep (`syncAllCybellumConnections`, service-role,
  06:00 CT). Both call the same shared sync helper — replicate that helper as a single
  service function and expose it from both the on-demand route and a cron runner. The sync
  is idempotent via upserts, so a missed or double run is safe.
- **Cybellum API paths:** the endpoint lists in `syncCybellum` are defensive fallbacks. If your
  tenant exposes a different API version, update the `ENDPOINTS` map (products / components /
  findings) and the probe paths in `testCybellumConnection` to match.
- **Field mapping:** the `pick(obj, [names])` helper tolerates varying Cybellum API shapes. If
  your tenant uses different property names, extend the name lists rather than hardcoding one.