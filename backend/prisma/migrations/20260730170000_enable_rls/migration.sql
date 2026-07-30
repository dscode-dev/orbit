-- ORBIT V2 — Tenant isolation with PostgreSQL Row Level Security.
--
-- The API must open a transaction and set these variables with set_config(..., true):
-- app.user_id, app.organization_id, app.business_unit_id,
-- app.business_unit_ids, app.roles, app.permissions, app.is_platform_admin.
--
-- Authentication bootstrap tables intentionally remain outside FORCE RLS:
-- users, credentials, mfa_factors, password_reset_tokens, sessions and
-- identity_invitations. Login/refresh/reset/invitation acceptance start before a
-- trusted tenant context exists and are protected by opaque tokens, hashes and
-- application-level authorization.

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_current_business_unit_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(current_setting('app.business_unit_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_current_business_unit_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN NULLIF(current_setting('app.business_unit_ids', true), '') IS NULL
      THEN ARRAY[]::uuid[]
    ELSE string_to_array(
      current_setting('app.business_unit_ids', true),
      ','
    )::uuid[]
  END
$$;

CREATE OR REPLACE FUNCTION app_current_roles()
RETURNS text[]
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN NULLIF(current_setting('app.roles', true), '') IS NULL
      THEN ARRAY[]::text[]
    ELSE string_to_array(current_setting('app.roles', true), ',')
  END
$$;

CREATE OR REPLACE FUNCTION app_current_permissions()
RETURNS text[]
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN NULLIF(current_setting('app.permissions', true), '') IS NULL
      THEN ARRAY[]::text[]
    ELSE string_to_array(current_setting('app.permissions', true), ',')
  END
$$;

CREATE OR REPLACE FUNCTION app_has_permission(required_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT required_permission = ANY(app_current_permissions())
$$;

CREATE OR REPLACE FUNCTION app_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.is_platform_admin', true), '')::boolean,
    false
  )
$$;

-- The organization root uses its primary key as tenant discriminator.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_tenant_isolation ON organizations
  FOR ALL
  USING (
    app_is_platform_admin()
    OR id = app_current_organization_id()
  )
  WITH CHECK (
    app_is_platform_admin()
    OR id = app_current_organization_id()
  );

-- Organization-scoped tables have a mandatory organization_id and do not
-- expose records across organizations.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'plan_usage',
    'integrations',
    'customers',
    'product_categories',
    'checklist_templates',
    'report_templates',
    'generated_documents',
    'signatures',
    'ai_agents',
    'ai_executions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (app_is_platform_admin() OR organization_id = app_current_organization_id()) WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id())',
      target_table || '_tenant_isolation',
      target_table
    );
  END LOOP;
END
$$;

-- Memberships participate in authentication bootstrap. A user may discover
-- only their own memberships before organization selection; tenant operators
-- can access other rows only inside the active organization/unit context.
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_memberships_read ON organization_memberships
  FOR SELECT
  USING (
    app_is_platform_admin()
    OR user_id = app_current_user_id()
    OR organization_id = app_current_organization_id()
  );
CREATE POLICY organization_memberships_write ON organization_memberships
  FOR ALL
  USING (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
  )
  WITH CHECK (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
  );

ALTER TABLE business_unit_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_unit_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY business_unit_memberships_read ON business_unit_memberships
  FOR SELECT
  USING (
    app_is_platform_admin()
    OR user_id = app_current_user_id()
    OR (
      organization_id = app_current_organization_id()
      AND business_unit_id = ANY(app_current_business_unit_ids())
    )
  );
CREATE POLICY business_unit_memberships_write ON business_unit_memberships
  FOR ALL
  USING (
    app_is_platform_admin()
    OR (
      organization_id = app_current_organization_id()
      AND business_unit_id = ANY(app_current_business_unit_ids())
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (
      organization_id = app_current_organization_id()
      AND business_unit_id = ANY(app_current_business_unit_ids())
    )
  );

-- System roles (organization_id IS NULL) are readable by every authenticated
-- tenant, but only platform administrators may create or mutate them.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
CREATE POLICY roles_read ON roles
  FOR SELECT
  USING (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
    OR (organization_id IS NULL AND app_current_user_id() IS NOT NULL)
  );
CREATE POLICY roles_insert ON roles
  FOR INSERT
  WITH CHECK (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
  );
CREATE POLICY roles_update ON roles
  FOR UPDATE
  USING (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
  )
  WITH CHECK (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
  );
CREATE POLICY roles_delete ON roles
  FOR DELETE
  USING (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
  );

-- Business units may be read/updated/deleted only when they belong to the
-- active unit set. Creation is organization-scoped because a new id cannot yet
-- exist in app.business_unit_ids.
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_units FORCE ROW LEVEL SECURITY;
CREATE POLICY business_units_read ON business_units
  FOR SELECT
  USING (
    app_is_platform_admin()
    OR (
      organization_id = app_current_organization_id()
      AND id = ANY(app_current_business_unit_ids())
    )
  );
CREATE POLICY business_units_insert ON business_units
  FOR INSERT
  WITH CHECK (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
  );
CREATE POLICY business_units_update ON business_units
  FOR UPDATE
  USING (
    app_is_platform_admin()
    OR (
      organization_id = app_current_organization_id()
      AND id = ANY(app_current_business_unit_ids())
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
  );
CREATE POLICY business_units_delete ON business_units
  FOR DELETE
  USING (
    app_is_platform_admin()
    OR (
      organization_id = app_current_organization_id()
      AND id = ANY(app_current_business_unit_ids())
    )
  );

-- Required business-unit scope.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'assets',
    'operations',
    'checklist_executions',
    'reports'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))) WITH CHECK (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids())))',
      target_table || '_unit_isolation',
      target_table
    );
  END LOOP;
END
$$;

-- Optional business-unit scope: NULL means organization-wide.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'contacts',
    'products',
    'notifications'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND (business_unit_id IS NULL OR business_unit_id = ANY(app_current_business_unit_ids())))) WITH CHECK (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND (business_unit_id IS NULL OR business_unit_id = ANY(app_current_business_unit_ids()))))',
      target_table || '_optional_unit_isolation',
      target_table
    );
  END LOOP;
END
$$;

-- Operation children inherit tenant and unit scope from their parent.
ALTER TABLE operation_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_users FORCE ROW LEVEL SECURITY;
CREATE POLICY operation_users_parent_isolation ON operation_users
  FOR ALL
  USING (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM operations
      WHERE operations.id = operation_users.operation_id
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM operations
      WHERE operations.id = operation_users.operation_id
    )
  );

ALTER TABLE operation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_history FORCE ROW LEVEL SECURITY;
CREATE POLICY operation_history_parent_isolation ON operation_history
  FOR ALL
  USING (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM operations
      WHERE operations.id = operation_history.operation_id
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM operations
      WHERE operations.id = operation_history.operation_id
    )
  );

-- Audit records may be platform-wide (organization_id NULL) or tenant scoped.
-- Tenant rows with business_unit_id NULL are organization-wide.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_read ON audit_logs
  FOR SELECT
  USING (
    app_is_platform_admin()
    OR (
      organization_id = app_current_organization_id()
      AND (
        business_unit_id IS NULL
        OR business_unit_id = ANY(app_current_business_unit_ids())
      )
    )
  );
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT
  WITH CHECK (
    app_is_platform_admin()
    OR (
      organization_id = app_current_organization_id()
      AND (
        business_unit_id IS NULL
        OR business_unit_id = ANY(app_current_business_unit_ids())
      )
    )
  );

-- Global catalog tables intentionally do not use tenant RLS:
-- modules and plans.
