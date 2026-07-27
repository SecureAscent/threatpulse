# Prisma migration baseline

The `20260716000000_baseline` migration creates the complete ThreatPulse schema
for a new database. It fixes clean installations, where the later hierarchy
migrations previously attempted to alter tables that had never been created.

## New database

Run the normal migration deployment:

```bash
cd nextjs_space
yarn prisma migrate deploy --schema=./prisma/schema.prisma
```

Prisma will apply the baseline first and then the hierarchy enforcement
migrations.

## Existing ThreatPulse database

Do not run the baseline SQL against an existing populated schema. Back up the
database, stop application and collector writers, verify that the existing
tables match the current Prisma schema, and then record the baseline without
executing it:

```bash
cd nextjs_space
yarn prisma migrate resolve \
  --applied 20260716000000_baseline \
  --schema=./prisma/schema.prisma
yarn prisma migrate deploy --schema=./prisma/schema.prisma
yarn prisma migrate status --schema=./prisma/schema.prisma
```

If schema verification shows differences, stop and repair those differences
before resolving or deploying migrations. Preserve the pre-deployment backup
until application, collector, tenant-isolation, and rollback checks pass.
