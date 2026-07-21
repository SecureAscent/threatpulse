-- Prevent threats from being assigned across tenants or to archived hierarchy nodes.
CREATE OR REPLACE FUNCTION "ThreatPulse_validate_active_threat_hierarchy"()
RETURNS trigger AS $$
DECLARE
  organization_archived TIMESTAMP(3);
  department_archived TIMESTAMP(3);
  department_organization TEXT;
BEGIN
  SELECT "archivedAt" INTO organization_archived
  FROM "Organization"
  WHERE id = NEW."organizationId";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Threat organization does not exist';
  END IF;

  IF organization_archived IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot assign a threat to an archived organization';
  END IF;

  IF NEW."departmentId" IS NOT NULL THEN
    SELECT "organizationId", "archivedAt"
    INTO department_organization, department_archived
    FROM "Department"
    WHERE id = NEW."departmentId";

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Threat department does not exist';
    END IF;

    IF department_organization IS DISTINCT FROM NEW."organizationId" THEN
      RAISE EXCEPTION 'Threat department does not belong to the selected organization';
    END IF;

    IF department_archived IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot assign a threat to an archived department';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Threat_active_hierarchy_guard" ON "Threat";
CREATE TRIGGER "Threat_active_hierarchy_guard"
BEFORE INSERT OR UPDATE OF "organizationId", "departmentId" ON "Threat"
FOR EACH ROW EXECUTE FUNCTION "ThreatPulse_validate_active_threat_hierarchy"();
