-- Platform administration foundation.
-- This migration is intentionally not executed by Codex.

CREATE TABLE "platform_role_assignments" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(3),
  CONSTRAINT "platform_role_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "platform_role_assignments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "platform_role_assignments_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "platform_role_assignments_user_id_role_id_key"
  ON "platform_role_assignments"("user_id", "role_id");
CREATE INDEX "platform_role_assignments_user_id_revoked_at_idx"
  ON "platform_role_assignments"("user_id", "revoked_at");
CREATE INDEX "platform_role_assignments_role_id_revoked_at_idx"
  ON "platform_role_assignments"("role_id", "revoked_at");

CREATE UNIQUE INDEX "roles_global_key_key"
  ON "roles"("key")
  WHERE "organization_id" IS NULL AND "deleted_at" IS NULL;

ALTER TABLE "platform_role_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_role_assignments" FORCE ROW LEVEL SECURITY;

CREATE POLICY "platform_role_assignments_read"
  ON "platform_role_assignments"
  FOR SELECT
  USING (
    app_is_platform_admin()
    OR "user_id" = app_current_user_id()
  );

CREATE POLICY "platform_role_assignments_write"
  ON "platform_role_assignments"
  FOR ALL
  USING (app_is_platform_admin())
  WITH CHECK (app_is_platform_admin());

-- Only a global role may be assigned through this table. A deferred trigger is
-- used so seed/upsert transactions remain atomic.
CREATE OR REPLACE FUNCTION enforce_global_platform_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM roles
    WHERE roles.id = NEW.role_id
      AND roles.organization_id IS NULL
      AND roles.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'platform role assignment requires a global role';
  END IF;
  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER "platform_role_assignments_global_role"
AFTER INSERT OR UPDATE OF "role_id" ON "platform_role_assignments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_global_platform_role();
