# ThreatPulse Tenancy Platform v1 Release Gates

Authoritative release branch: `release/tenancy-platform-v1`
Target branch: `main`

## Branch reconciliation

- [x] Create release branch from the tenancy hardening branch.
- [x] Open draft release PR targeting `main`.
- [x] Reconcile the self-hosted host inspection workflow content from `main`.
- [ ] Merge `main` history into the release branch.
- [ ] Confirm no unique production functionality remains stranded in `docker-stack`.

## Database

- [ ] Validate Prisma schema formatting and client generation.
- [ ] Validate all migrations on a new PostgreSQL database.
- [ ] Validate upgrade from the currently deployed production schema.
- [ ] Confirm hierarchy constraint and trigger migrations are idempotent where required.
- [ ] Verify SUPERADMIN creation after migration.
- [ ] Capture backup and rollback commands.

## Security and tenancy

- [ ] Verify organization isolation for every tenant-owned model.
- [ ] Verify department isolation for department-scoped roles.
- [ ] Verify parent-administrator scope.
- [ ] Verify archived parent, organization, and department access is denied.
- [ ] Verify integration configuration and sync-run scope.
- [ ] Verify asset, product version, SBOM, component, and vulnerability scope.
- [ ] Verify audit-log visibility and actor metadata.
- [ ] Run negative cross-tenant authorization tests.

## Build and operations

- [ ] Run application lint, type checking, tests, and production build.
- [ ] Run collector tests and production build.
- [ ] Validate `docker-compose.prod.yml` interpolation and service health checks.
- [ ] Validate Nginx configuration.
- [ ] Validate database backup and restore procedures.
- [ ] Validate deployment host inspection workflow.

## Release

- [ ] Record final commit SHA and migration state.
- [ ] Update deployment and rollback runbooks.
- [ ] Mark release PR ready for review.
- [ ] Merge to `main`.
- [ ] Tag the release.
- [ ] Verify production after deployment.
