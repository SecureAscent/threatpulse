# Port #00 — Baseline: Current SaaS State Snapshot

> Authoritative snapshot of the **Base44 SaaS builder** state of ThreatPulse as of 2026-08-03.
> This is the reference contract the self-hosted Docker stack ports against. Docs-only — touches nothing outside `packets/00-baseline-current-state/`.

## Why this packet exists
The SaaS builder is the source of truth for product behavior. Rather than port feature-by-feature, this packet captures the *entire current state* in one merge so the self-hosted team has a complete reference (data model, access rules, functions, routes, integrations) to adapt to the Docker stack.

## Contents
- `docs/entities-and-rls.md` — every entity: fields, required, and Row-Level Security rules (the access contract).
- `docs/functions-pages-workflows.md` — backend functions + contracts, page/route inventory, workflows, connectors, secrets, integration packages.

## Snapshot counts
- **Entities:** 13 (12 domain + built-in User)
- **Backend functions:** 10
- **Pages / routes:** ~30 (5 public, 4 auth, ~22 protected)
- **Workflows:** 2
- **App connectors:** 2 (github, googledrive)
- **Secrets:** 3 (RESEND_API_KEY, PRINTIFY_API_TOKEN, NVD_API_KEY)

## How to use
1. Merge this PR to land the baseline reference in the self-hosted repo.
2. Future port packets (`port/01-...`, `port/02-...`, `port/03-...`) build on top of these contracts.
3. Where the self-hosted stack diverges (framework, ORM, auth), adapt the *contract* here, not the SaaS implementation detail.

## Status
**Baseline — supersedes nothing.** Port #02 (intelligence-domain architecture) extends the exposure-intelligence portion of this baseline; it remains the authoritative design for that domain.