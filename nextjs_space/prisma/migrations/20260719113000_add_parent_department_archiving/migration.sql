-- Add lifecycle archive timestamps to hierarchy entities.
ALTER TABLE "ParentOrganization"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE "Department"
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ParentOrganization_archivedAt_idx"
ON "ParentOrganization"("archivedAt");

CREATE INDEX IF NOT EXISTS "Department_archivedAt_idx"
ON "Department"("archivedAt");
