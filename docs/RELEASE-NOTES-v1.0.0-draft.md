# ThreatPulse v1.0.0 — Draft Release Notes

## Highlights

- Multi-tenant organization, parent-organization, and department hierarchy.
- Tenant-aware role-based access control and authorization refresh.
- Archive and restore lifecycle with active-hierarchy enforcement.
- Tenant-scoped threat intelligence collection and threat management.
- Administrative audit events and audit log interface.
- Connector framework with synchronization run tracking.
- Asset, product version, SBOM, software component, and vulnerability data models.
- Production Docker Compose stack, Nginx, TLS automation, backup tooling, and operational documentation.

## Security changes

- Cross-tenant request paths are scoped by organization and, where applicable, department.
- Parent administrators are restricted to organizations under their assigned parent.
- Archived tenant hierarchy records revoke authentication and assignment eligibility.
- Collector tenant selection fails closed.
- Administrative and threat lifecycle changes produce audit events.
- Database constraints and triggers enforce active hierarchy relationships for sensitive records.

## Deployment impact

This release includes Prisma schema and PostgreSQL migration changes. Back up the production database before deployment, apply migrations before starting the rebuilt application, and rebuild both application and collector images.

Exact deployment, verification, and rollback commands will be finalized after release-gate validation.

## Known release gates

- Merge current `main` history into the release branch.
- Validate clean-install and production-upgrade migration paths.
- Complete authorization matrix testing.
- Validate application and collector production builds.
- Validate production Compose and Nginx configuration.
- Confirm backup and restore procedures.
