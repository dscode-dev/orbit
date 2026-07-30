-- PR-03 Organization invariants not expressible in Prisma schema.

CREATE UNIQUE INDEX IF NOT EXISTS business_units_one_primary_per_org
  ON business_units (organization_id)
  WHERE is_primary = true
    AND deleted_at IS NULL
    AND status = 'ACTIVE';

ALTER TABLE organizations
  ADD CONSTRAINT organizations_valid_subscription_period
  CHECK (
    current_period_start IS NULL
    OR current_period_end IS NULL
    OR current_period_end > current_period_start
  );

ALTER TABLE plan_usage
  ADD CONSTRAINT plan_usage_non_negative
  CHECK (used >= 0 AND reserved >= 0),
  ADD CONSTRAINT plan_usage_valid_period
  CHECK (period_end > period_start);
