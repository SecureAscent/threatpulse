# Functions, Pages, Workflows & Integrations (Current State)

---

## Backend functions (`base44/functions/<name>/entry.ts`)

| Function | Purpose | Inputs | Outputs | Uses |
|---|---|---|---|---|
| `ingestFeeds` | Pull RSS/News/NVD threat feeds into Threat records | (admin trigger) | created/updated counts | NVD_API_KEY secret |
| `ingestThreatActors` | Sync Ransomware.live victims + groups into ThreatActor | (admin trigger) | inserted/dedup counts | external API (ransomware.live v2) |
| `enrichIoc` | Enrich an IOC value with threat context | ioc value/type | enrichment json | Core.InvokeLLM |
| `slaBreachAlert` | Email alert when a threat breaches SLA | threat id | send status | Core.SendEmail |
| `sendSlackAlert` | Post a critical-threat alert to Slack | threat summary | send status | Slack webhook (secret/URL) |
| `submitContactSales` | Forward Contact-Sales lead to sales inbox | form payload (name,email,company,tier,message) | send status | RESEND_API_KEY |
| `redeemActivationKey` | Validate + redeem an ActivationKey for a user | code | tier + status | ActivationKey entity |
| `createPrintifyProduct` | Create a merch product via Printify | product spec | Printify product id | PRINTIFY_API_TOKEN |
| `saveToDrive` | Upload a file to the builder Google Drive | filename, content, mime | Drive file id | googledrive connector |
| `pushPortPacket` | Commit + PR port-packet files to a GitHub repo | repo, branch, files[], prTitle | commit + PR url | github connector |

> Auth: admin/superadmin-gated where noted. Each runs server-side in the Base44 function runtime; self-hosted ports should reproduce the contract (inputs/outputs/secrets), not the runtime.

---

## Pages & routes (`src/App.jsx`)

### Public (no auth)
/ (Home), /shop, /pricing, /free, /contact-sales

### Auth (unauthenticated only)
/login, /register, /forgot-password, /reset-password

### Protected (behind `ProtectedRoute` + `DashboardLayout`)
/dashboard, /command-center, /active-incidents, /threat-feed, /threats, /threat-actors, /threats/:id, /cve-database, /upload, /feeds, /blast-radius, /compliance, /jira-tickets, /notifications, /integrations, /metrics, /executive-brief (alias of /metrics), /product-portfolio, /actioned-threats, /how-it-works, /policy, /admin, /admin/api-keys, /admin/setup, /admin/create-product, /settings/security, /settings/notifications

> Auth hardening: `AuthContext` strips query params on auth redirect to prevent URL-encoding loops; marketing pages are exempt from auto-login redirect.

---

## Workflows (`base44/workflows/*.jsonc`)

- **SLA Breach Alert** — scheduled; invokes `slaBreachAlert` for threats past SLA without a prior alert.
- **Critical Threat Slack Alert** — entity trigger on Threat create (Critical severity); invokes `sendSlackAlert`.

> Trigger/step specifics live in each `.jsonc`; reproduce as cron + event handlers in the self-hosted stack.

---

## App connectors (OAuth)
- **github** — scope `repo`; used by `pushPortPacket`.
- **googledrive** — scopes `drive.file`, `email`; used by `saveToDrive`. Webhooks supported (changes/file).

## Secrets
| Secret | Used by |
|---|---|
| `RESEND_API_KEY` | submitContactSales (external lead email) |
| `PRINTIFY_API_TOKEN` | createPrintifyProduct |
| `NVD_API_KEY` | ingestFeeds (NVD rate-limit handling) |

## Integration package `Core` (built-in)
InvokeLLM, SendEmail (registered users only), UploadFile, UploadPrivateFile, CreateFileSignedUrl, GenerateImage, GenerateSpeech, GenerateVideo, TranscribeAudio, ExtractDataFromUploadedFile.

---

## Open issues carried into baseline
- Bleeping Computer + ThreatFox ingestion blocked by Cloudflare for datacenter IPs.
- rss2json free tier rate-limited (avoid for production).
- Ransomware.live free v2 API in use (PRO key not adopted).