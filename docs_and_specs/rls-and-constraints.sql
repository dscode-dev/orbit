-- LEGACY REFERENCE ONLY — DO NOT APPLY.
-- The executable, schema-aligned RLS definition is now:
-- backend/prisma/migrations/20260730170000_enable_rls/migration.sql
-- This historical draft is retained only for design traceability.

-- ORBIT V2 — PostgreSQL 17 hardening migration
-- Run after Prisma creates the tables.

-- Request-scoped variables must be set by the API transaction:
-- SET LOCAL app.user_id = '<uuid>';
-- SET LOCAL app.organization_id = '<uuid>';
-- SET LOCAL app.business_unit_ids = '<uuid,uuid,...>';
-- SET LOCAL app.is_platform_admin = 'false';

CREATE OR REPLACE FUNCTION app_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_current_business_unit_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN NULLIF(current_setting('app.business_unit_ids', true), '') IS NULL THEN ARRAY[]::uuid[]
    ELSE string_to_array(current_setting('app.business_unit_ids', true), ',')::uuid[]
  END
$$;

CREATE OR REPLACE FUNCTION app_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_platform_admin', true), '')::boolean, false)
$$;

-- Root Organization policy uses its own primary key as tenant scope.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant_scope ON organizations
  USING (app_is_platform_admin() OR id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR id = app_current_organization_id());

-- Organization-scoped tables.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organization_settings', 'organization_memberships', 'roles',
    'organization_segments', 'organization_modules',
    'organization_capabilities', 'subscriptions', 'usage_counters',
    'operation_types', 'document_templates'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (app_is_platform_admin() OR organization_id = app_current_organization_id()) WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id())',
      table_name || '_organization_scope', table_name
    );
  END LOOP;
END $$;

-- BusinessUnit itself uses id as its unit scope.
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_units FORCE ROW LEVEL SECURITY;
CREATE POLICY business_units_scope ON business_units
  USING (
    app_is_platform_admin()
    OR (organization_id = app_current_organization_id() AND id = ANY(app_current_business_unit_ids()))
  )
  WITH CHECK (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
  );

-- Business-unit-scoped tables.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'business_unit_memberships', 'customers', 'contacts',
    'assets', 'asset_identifiers', 'products', 'operations',
    'operation_participants', 'operation_status_history', 'reports',
    'documents', 'file_objects', 'integration_connections', 'audit_logs',
    'outbox_messages'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND (business_unit_id IS NULL OR business_unit_id = ANY(app_current_business_unit_ids())))) WITH CHECK (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND (business_unit_id IS NULL OR business_unit_id = ANY(app_current_business_unit_ids()))))',
      table_name || '_business_unit_scope', table_name
    );
  END LOOP;
END $$;

-- Exactly one active primary BusinessUnit per Organization.
CREATE UNIQUE INDEX IF NOT EXISTS business_units_one_primary_per_org
  ON business_units (organization_id)
  WHERE is_primary = true AND deleted_at IS NULL AND status = 'ACTIVE';

-- Exactly one active subscription per Organization.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_active_per_org
  ON subscriptions (organization_id)
  WHERE status IN ('TRIALING', 'ACTIVE', 'PAST_DUE');

-- Protect nullable unique business identifiers from soft-delete collisions.
DROP INDEX IF EXISTS customers_business_unit_id_document_type_document_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS customers_unit_document_unique_active
  ON customers (business_unit_id, document_type, document_number)
  WHERE document_number IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS assets_business_unit_id_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS assets_unit_code_unique_active
  ON assets (business_unit_id, code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS assets_business_unit_id_serial_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS assets_unit_serial_unique_active
  ON assets (business_unit_id, serial_number)
  WHERE serial_number IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS products_business_unit_id_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS products_unit_sku_unique_active
  ON products (business_unit_id, sku)
  WHERE sku IS NOT NULL AND deleted_at IS NULL;

-- MembershipRole must target exactly one membership scope.
ALTER TABLE membership_roles
  ADD CONSTRAINT membership_roles_exactly_one_scope
  CHECK (num_nonnulls(organization_membership_id, business_unit_membership_id) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS membership_roles_org_role_unique
  ON membership_roles (organization_membership_id, role_id)
  WHERE organization_membership_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS membership_roles_unit_role_unique
  ON membership_roles (business_unit_membership_id, role_id)
  WHERE business_unit_membership_id IS NOT NULL;

-- Plan limit consistency.
ALTER TABLE plan_limits
  ADD CONSTRAINT plan_limits_value_consistency
  CHECK (
    (is_unlimited = true AND limit_value IS NULL)
    OR
    (is_unlimited = false AND limit_value IS NOT NULL AND limit_value >= 0)
  );

-- Temporal and monetary integrity.
ALTER TABLE plan_prices
  ADD CONSTRAINT plan_prices_positive_amount CHECK (amount_minor >= 0),
  ADD CONSTRAINT plan_prices_valid_window CHECK (ends_at IS NULL OR ends_at > starts_at);

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_valid_period CHECK (current_period_end > current_period_start);

ALTER TABLE operations
  ADD CONSTRAINT operations_valid_schedule CHECK (
    scheduled_end_at IS NULL OR scheduled_start_at IS NULL OR scheduled_end_at > scheduled_start_at
  );

-- Append-only audit/event tables.
CREATE OR REPLACE FUNCTION reject_mutation_on_append_only_table()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION reject_mutation_on_append_only_table();

CREATE TRIGGER operation_status_history_append_only
BEFORE UPDATE OR DELETE ON operation_status_history
FOR EACH ROW EXECUTE FUNCTION reject_mutation_on_append_only_table();
