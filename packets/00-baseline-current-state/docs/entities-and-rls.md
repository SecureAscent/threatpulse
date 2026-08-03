# Entities & Row-Level Security (Current State)

Conventions: `read/create/update/delete` show the RLS rule per op. `{}` = open to any authenticated user. `$or` = any condition matches. `created_by_id` = record owner. Role values: `superadmin`, `admin`, `analyst`, `user`.

---

## Threat (core threat record)
- **Required:** title, severity, type, status
- **Fields:** title, description, severity (Critical/High/Medium/Low), type (Vulnerability/Ransomware/Campaign/Malware/Breach/Advisory/Other), cve_id, cvss_score, source, source_url, status (New/Analyzing/Mitigated), assigned_to, notes, affected_products, estimated_downtime_hours, estimated_recovery_cost, first_response_date, closed_date, sla_alert_sent
- **RLS:** read open; create admin/superadmin; **update open**; delete admin/superadmin

## ThreatActor (platform-intelligence: actors/malware/campaigns/IOCs)
- **Required:** name, kind, source
- **Fields:** name, aliases, kind (threat_actor/malware/campaign/darkweb_mention/indicator), ioc_value, ioc_type, threat_type, confidence, malware_printable, first_seen, last_seen, source, source_url, tags, reporter, notes
- **RLS:** read open; create/update/delete admin/superadmin

## ThreatActivity (audit timeline per threat)
- **Required:** threat_id, action, description
- **Fields:** threat_id, action (created/status_change/assign/note/severity_change/reopen/investigation_step), description, old_value, new_value, actor_name
- **RLS:** read open; create open; update/delete admin/superadmin

## Comment (threaded threat discussion)
- **Required:** threat_id, body
- **Fields:** threat_id, parent_id, body, mentions, actor_name
- **RLS:** read open; create open; update/delete admin/superadmin

## Evidence (file artifacts attached to a threat)
- **Required:** threat_id, file_name, file_url
- **Fields:** threat_id, file_name, file_url, content_type, uploaded_by
- **RLS:** read open; create open; update/delete admin/superadmin

## Watchlist (user saved searches / pinned items)
- **Required:** name, kind
- **Fields:** name, kind (saved_search/pinned_threat/pinned_actor/pinned_cve/pinned_product), filters, ref_id, ref_label, owner_name
- **RLS:** all open {}

## TenantWatchlist (tenant-scoped monitored terms for exposure)
- **Required:** name, kind
- **Fields:** name, organizationId (tenant scope), kind (domain/keyword/email/identity), terms, enabled, owner_name, notes
- **RLS:** read open; create open; update/delete = owner OR admin/superadmin

## IntelligenceSource (registry of intel feed providers)
- **Required:** name, kind, license_class
- **Fields:** name, provider, kind (feed/breach_notification/licensed_api/public/tor), license_class (commercial/open/restricted), terms_summary, reliability (Admiralty A–F), default_confidence, auth_required, enabled, last_ingested_date, ingest_count, last_error, notes
- **RLS:** read open; create/update/delete admin/superadmin

## ExposureFinding (tenant-scoped credential leak / mention / exposure)
- **Required:** organizationId, kind, severity, status
- **Fields:** organizationId, watchlist_id, kind (credential_leak/mention/domain_exposure/identity_exposure), severity, title, summary, affected_identity (masked), credential_sample (masked), credential_hash, source_id, source_url, retrieved_at, published_at, first_seen, last_seen, confidence, reliability, attribution_status (UNCONFIRMED/POSSIBLE/PROBABLE/CONFIRMED), fingerprint, terms_class, status (new/validated/false_positive/remediated), assigned_to, validation_notes, retention_expires, notes
- **RLS:** read open; create admin/superadmin; update analyst/admin/superadmin; delete admin/superadmin

## ExposureEvidence (masked evidence + reveal audit for a finding)
- **Required:** finding_id, organizationId
- **Fields:** finding_id, organizationId, source_id, captured_date, published_date, content_excerpt (masked), fingerprint, content_hash (SHA-256), terms_class, revealed, reveal_expires, reveal_audit, retention_expires, notes
- **RLS:** read open; create/update/delete admin/superadmin

## ActivationKey (redeemable tier codes)
- **Required:** code, tier, status
- **Fields:** code, tier (SmallMidsize/Enterprise), status (active/redeemed), redeemed_by_id, redeemed_by_email, redeemed_date, notes
- **RLS:** read/create/update/delete admin/superadmin

## Product (portfolio asset for blast-radius mapping)
- **Required:** name
- **Fields:** name, vendor, current_version, status (Active/Inactive/Retired), end_of_life_date, owner, notes
- **RLS:** none declared → all open (default)

## User (built-in)
- **Fields (read-only):** id, created_date, full_name, email; **editable:** role (superadmin/admin/analyst/user)
- **Security:** only admins list/update/delete other users. Records cannot be inserted — users join via invites.

---

## Tenancy note
`ExposureFinding`, `ExposureEvidence`, and `TenantWatchlist` carry `organizationId` as the tenant scope. The general `Threat`/`ThreatActor`/`Evidence` entities are **not tenant-scoped** (platform-wide intel). Port #02 defines the isolation strategy for the exposure domain.