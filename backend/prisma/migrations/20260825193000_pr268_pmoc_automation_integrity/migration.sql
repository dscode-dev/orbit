-- Automation organization scope is an immutable-at-write snapshot, never an
-- ambiguous NULL meaning "whatever the actor can see later".
ALTER TABLE automation_rules
  ADD COLUMN scope_business_unit_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

UPDATE automation_rules r
   SET scope_business_unit_ids = CASE
     WHEN r.business_unit_id IS NOT NULL THEN ARRAY[r.business_unit_id]::uuid[]
     ELSE ARRAY(
       SELECT bu.id
         FROM business_units bu
        WHERE bu.organization_id = r.organization_id
          AND bu.deleted_at IS NULL
          AND bu.status = 'ACTIVE'
       ORDER BY bu.id
     )
   END;

-- One plan/due date is one operational cycle. Abort the migration if legacy
-- duplicates exist; silently deleting regulatory history is not acceptable.
CREATE UNIQUE INDEX pmoc_executions_plan_due_on_key
  ON pmoc_executions (plan_id, due_on);
