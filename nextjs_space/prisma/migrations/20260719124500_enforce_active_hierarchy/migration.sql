-- Enforce active hierarchy relationships at the database boundary.
CREATE OR REPLACE FUNCTION "ThreatPulse_validate_active_hierarchy"()
RETURNS trigger AS $$
DECLARE
  parent_archived TIMESTAMP(3);
  organization_archived TIMESTAMP(3);
  department_archived TIMESTAMP(3);
  department_organization TEXT;
BEGIN
  IF TG_TABLE_NAME = 'Organization' AND NEW."parentOrganizationId" IS NOT NULL THEN
    SELECT "archivedAt" INTO parent_archived
    FROM "ParentOrganization"
    WHERE id = NEW."parentOrganizationId";

    IF parent_archived IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot assign an organization to an archived parent organization';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'Department' THEN
    SELECT "archivedAt" INTO organization_archived
    FROM "Organization"
    WHERE id = NEW."organizationId";

    IF organization_archived IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot create or move a department under an archived organization';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'User' AND NEW."organizationId" IS NOT NULL THEN
    SELECT "archivedAt" INTO organization_archived
    FROM "Organization"
    WHERE id = NEW."organizationId";

    IF organization_archived IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot assign a user to an archived organization';
    END IF;

    IF NEW."departmentId" IS NOT NULL THEN
      SELECT "organizationId", "archivedAt"
      INTO department_organization, department_archived
      FROM "Department"
      WHERE id = NEW."departmentId";

      IF department_organization IS DISTINCT FROM NEW."organizationId" THEN
        RAISE EXCEPTION 'Department does not belong to the selected organization';
      END IF;

      IF department_archived IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot assign a user to an archived department';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Organization_active_parent_guard" ON "Organization";
CREATE TRIGGER "Organization_active_parent_guard"
BEFORE INSERT OR UPDATE OF "parentOrganizationId" ON "Organization"
FOR EACH ROW EXECUTE FUNCTION "ThreatPulse_validate_active_hierarchy"();

DROP TRIGGER IF EXISTS "Department_active_organization_guard" ON "Department";
CREATE TRIGGER "Department_active_organization_guard"
BEFORE INSERT OR UPDATE OF "organizationId" ON "Department"
FOR EACH ROW EXECUTE FUNCTION "ThreatPulse_validate_active_hierarchy"();

DROP TRIGGER IF EXISTS "User_active_hierarchy_guard" ON "User";
CREATE TRIGGER "User_active_hierarchy_guard"
BEFORE INSERT OR UPDATE OF "organizationId", "departmentId" ON "User"
FOR EACH ROW EXECUTE FUNCTION "ThreatPulse_validate_active_hierarchy"();
