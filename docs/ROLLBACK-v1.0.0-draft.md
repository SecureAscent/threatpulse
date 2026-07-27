# ThreatPulse v1.0.0 — Draft Rollback Procedure

Do not use this procedure until the release candidate commit and production database backup have been recorded.

## Before deployment

1. Record the currently deployed Git commit.
2. Record the current Prisma migration state.
3. Create and verify a PostgreSQL backup.
4. Record current container image identifiers.
5. Confirm access to the deployment host and database restore credentials.

## Application rollback

1. Stop application traffic or place the service in maintenance mode.
2. Check out the previously deployed Git commit.
3. Rebuild or restore the previously deployed application and collector images.
4. Start the prior stack without applying additional migrations.
5. Verify authentication, tenant scope, collector health, and API health.

## Database rollback

Prisma migrations are normally forward-only. Prefer a tested forward repair when application compatibility permits.

When a database restore is required:

1. Stop the application and collector to prevent writes.
2. Preserve the failed database as an incident snapshot.
3. Restore the verified pre-deployment PostgreSQL backup.
4. Confirm migration history matches the previous application commit.
5. Start the previous application stack.
6. Perform tenant-isolation and administrative smoke tests.

## Required verification

- SUPERADMIN authentication succeeds.
- Organization and department assignments load correctly.
- Archived hierarchy access remains denied.
- Threat and asset queries do not cross tenant boundaries.
- Collector writes target the configured organization.
- Audit and integration endpoints respond successfully.

Final commands and backup paths must be filled in during release-candidate validation.
