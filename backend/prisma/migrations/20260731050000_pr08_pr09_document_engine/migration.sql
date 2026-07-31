-- PR-08 / PR-09 — versioned document source, PDF integrity and signatures.
-- This migration is intentionally not executed by Codex.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "reports"
  ADD COLUMN "render_settings" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "content_hash" CHAR(64);

UPDATE "reports"
SET "content_hash" = encode(
  digest(
    convert_to(
      jsonb_build_object(
        'templateId', "template_id",
        'templateVersion', "template_version",
        'code', "code",
        'title', "title",
        'businessUnitId', "business_unit_id",
        'operationId', "operation_id",
        'customerId', "customer_id",
        'sections', "sections",
        'signatureSlots', "signature_slots",
        'renderSettings', "render_settings",
        'data', "data"
      )::text,
      'UTF8'
    ),
    'sha256'
  ),
  'hex'
)
WHERE "content_hash" IS NULL;

ALTER TABLE "reports"
  ALTER COLUMN "content_hash" SET NOT NULL;

ALTER TABLE "generated_documents"
  ADD COLUMN "source_hash" CHAR(64);

UPDATE "generated_documents" AS document
SET "source_hash" = report."content_hash"
FROM "reports" AS report
WHERE report."id" = document."report_id"
  AND document."source_hash" IS NULL;

ALTER TABLE "generated_documents"
  ALTER COLUMN "source_hash" SET NOT NULL;

ALTER TABLE "signatures"
  ADD COLUMN "report_content_hash" CHAR(64);

UPDATE "signatures" AS signature
SET "report_content_hash" = report."content_hash"
FROM "reports" AS report
WHERE report."id" = signature."report_id"
  AND signature."report_content_hash" IS NULL;

ALTER TABLE "signatures"
  ALTER COLUMN "report_content_hash" SET NOT NULL;

DROP POLICY IF EXISTS "generated_documents_tenant_isolation"
  ON "generated_documents";
CREATE POLICY "generated_documents_parent_isolation"
  ON "generated_documents"
  FOR ALL
  USING (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND EXISTS (
        SELECT 1
        FROM "reports"
        WHERE "reports"."id" = "generated_documents"."report_id"
          AND "reports"."organization_id" = app_current_organization_id()
          AND "reports"."business_unit_id" =
            ANY(app_current_business_unit_ids())
      )
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND EXISTS (
        SELECT 1
        FROM "reports"
        WHERE "reports"."id" = "generated_documents"."report_id"
          AND "reports"."organization_id" = app_current_organization_id()
          AND "reports"."business_unit_id" =
            ANY(app_current_business_unit_ids())
      )
    )
  );

DROP POLICY IF EXISTS "signatures_tenant_isolation" ON "signatures";
CREATE POLICY "signatures_parent_isolation"
  ON "signatures"
  FOR ALL
  USING (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND EXISTS (
        SELECT 1
        FROM "reports"
        WHERE "reports"."id" = "signatures"."report_id"
          AND "reports"."organization_id" = app_current_organization_id()
          AND "reports"."business_unit_id" =
            ANY(app_current_business_unit_ids())
      )
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND EXISTS (
        SELECT 1
        FROM "reports"
        WHERE "reports"."id" = "signatures"."report_id"
          AND "reports"."organization_id" = app_current_organization_id()
          AND "reports"."business_unit_id" =
            ANY(app_current_business_unit_ids())
      )
    )
  );

DROP INDEX IF EXISTS "reports_organization_id_code_key";
CREATE UNIQUE INDEX "reports_code_unique_active"
  ON "reports"("organization_id", "code")
  WHERE "deleted_at" IS NULL;

DROP INDEX IF EXISTS "signatures_report_id_slot_key_key";
CREATE UNIQUE INDEX "signatures_slot_unique_active"
  ON "signatures"("report_id", "slot_key")
  WHERE "revoked_at" IS NULL;

CREATE UNIQUE INDEX "generated_documents_storage_key_key"
  ON "generated_documents"("storage_key");

CREATE UNIQUE INDEX "signatures_signature_hash_key"
  ON "signatures"("signature_hash");

CREATE UNIQUE INDEX "report_templates_default_kind_unique_active"
  ON "report_templates"("organization_id", "report_kind")
  WHERE "deleted_at" IS NULL
    AND "is_active" = true
    AND "is_default" = true;

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_status_check"
  CHECK (
    "status" IN (
      'DRAFT',
      'IN_REVIEW',
      'APPROVED',
      'PUBLISHED',
      'ARCHIVED'
    )
  );

ALTER TABLE "generated_documents"
  ADD CONSTRAINT "generated_documents_format_check"
  CHECK ("format" = 'PDF'),
  ADD CONSTRAINT "generated_documents_size_check"
  CHECK ("size_bytes" > 0);

UPDATE "plans"
SET "capabilities" = ARRAY(
  SELECT DISTINCT capability
  FROM unnest(
    "capabilities" || ARRAY[
      'document_engine.read',
      'document_engine.manage',
      'reports.read',
      'reports.manage',
      'reports.render',
      'signatures.read',
      'signatures.manage'
    ]::varchar[]
  ) AS capability
)
WHERE "is_active" = true;
