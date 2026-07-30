-- PR-07 Operations — attachments, active uniqueness and domain constraints.
-- This migration is intentionally not executed by Codex.

CREATE TABLE "operation_attachments" (
  "id" UUID NOT NULL,
  "operation_id" UUID NOT NULL,
  "uploaded_by_id" UUID NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(160) NOT NULL,
  "size" INTEGER NOT NULL,
  "storage_key" VARCHAR(255) NOT NULL,
  "checksum" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "operation_attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operation_attachments_size_check"
    CHECK ("size" > 0 AND "size" <= 20971520),
  CONSTRAINT "operation_attachments_operation_id_fkey"
    FOREIGN KEY ("operation_id") REFERENCES "operations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "operation_attachments_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "operation_attachments_storage_key_key"
  ON "operation_attachments"("storage_key");

CREATE INDEX "operation_attachments_operation_id_created_at_idx"
  ON "operation_attachments"("operation_id", "created_at");

ALTER TABLE "operation_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operation_attachments" FORCE ROW LEVEL SECURITY;

CREATE POLICY "operation_attachments_parent_isolation"
  ON "operation_attachments"
  FOR ALL
  USING (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM "operations"
      WHERE "operations"."id" = "operation_attachments"."operation_id"
        AND "operations"."organization_id" = app_current_organization_id()
        AND "operations"."business_unit_id" =
          ANY(app_current_business_unit_ids())
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM "operations"
      WHERE "operations"."id" = "operation_attachments"."operation_id"
        AND "operations"."organization_id" = app_current_organization_id()
        AND "operations"."business_unit_id" =
          ANY(app_current_business_unit_ids())
    )
  );

DROP INDEX IF EXISTS "operations_organization_id_code_key";

CREATE UNIQUE INDEX "operations_code_unique_active"
  ON "operations"("organization_id", "code")
  WHERE "deleted_at" IS NULL;

ALTER TABLE "operations"
  ADD CONSTRAINT "operations_schedule_check"
  CHECK (
    "scheduled_start" IS NULL
    OR "scheduled_end" IS NULL
    OR "scheduled_end" >= "scheduled_start"
  ),
  ADD CONSTRAINT "operations_status_check"
  CHECK (
    "status" IN (
      'OPEN',
      'SCHEDULED',
      'IN_PROGRESS',
      'PAUSED',
      'COMPLETED',
      'CANCELLED'
    )
  ),
  ADD CONSTRAINT "operations_priority_check"
  CHECK ("priority" IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));

UPDATE "plans"
SET "capabilities" = ARRAY(
  SELECT DISTINCT capability
  FROM unnest(
    "capabilities" || ARRAY[
      'operations.read',
      'operations.manage'
    ]::varchar[]
  ) AS capability
)
WHERE "is_active" = true;
