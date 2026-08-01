-- PR-17 — canonical Artifact Template Engine.
-- This migration is intentionally additive: legacy report/checklist contracts
-- remain available while their definitions are linked to the canonical model.

CREATE TABLE "artifact_templates" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "created_by_id" UUID,
  "key" VARCHAR(100) NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "description" TEXT,
  "artifact_type" VARCHAR(80) NOT NULL,
  "segment" VARCHAR(60),
  "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "visibility" VARCHAR(30) NOT NULL DEFAULT 'ORGANIZATION',
  "tags" VARCHAR(80)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(80)[],
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "current_version" INTEGER NOT NULL DEFAULT 1,
  "source" VARCHAR(30) NOT NULL DEFAULT 'NATIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "artifact_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "artifact_templates_status_check"
    CHECK ("status" IN ('DRAFT', 'ACTIVE', 'INACTIVE')),
  CONSTRAINT "artifact_templates_visibility_check"
    CHECK ("visibility" IN ('PRIVATE', 'ORGANIZATION', 'GLOBAL')),
  CONSTRAINT "artifact_templates_owner_visibility_check"
    CHECK (
      ("organization_id" IS NULL AND "visibility" = 'GLOBAL')
      OR "organization_id" IS NOT NULL
    ),
  CONSTRAINT "artifact_templates_current_version_check"
    CHECK ("current_version" > 0)
);

CREATE TABLE "artifact_template_versions" (
  "id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "organization_id" UUID,
  "created_by_id" UUID,
  "version" INTEGER NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sections" JSONB NOT NULL DEFAULT '[]',
  "signature_slots" JSONB NOT NULL DEFAULT '[]',
  "layout" JSONB NOT NULL DEFAULT '{}',
  "change_summary" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "artifact_template_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "artifact_template_versions_version_check" CHECK ("version" > 0),
  CONSTRAINT "artifact_template_versions_sections_check"
    CHECK (jsonb_typeof("sections") = 'array'),
  CONSTRAINT "artifact_template_versions_signatures_check"
    CHECK (jsonb_typeof("signature_slots") = 'array'),
  CONSTRAINT "artifact_template_versions_metadata_check"
    CHECK (jsonb_typeof("metadata") = 'object'),
  CONSTRAINT "artifact_template_versions_layout_check"
    CHECK (jsonb_typeof("layout") = 'object')
);

CREATE UNIQUE INDEX "artifact_templates_organization_id_key_key"
  ON "artifact_templates"("organization_id", "key");
CREATE UNIQUE INDEX "artifact_templates_global_key_unique"
  ON "artifact_templates"("key") WHERE "organization_id" IS NULL;
CREATE INDEX "artifact_templates_organization_status_visibility_idx"
  ON "artifact_templates"("organization_id", "status", "visibility", "deleted_at");
CREATE INDEX "artifact_templates_type_segment_idx"
  ON "artifact_templates"("artifact_type", "segment");
CREATE UNIQUE INDEX "artifact_template_versions_template_version_key"
  ON "artifact_template_versions"("template_id", "version");
CREATE INDEX "artifact_template_versions_organization_created_idx"
  ON "artifact_template_versions"("organization_id", "created_at");

ALTER TABLE "artifact_templates"
  ADD CONSTRAINT "artifact_templates_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "artifact_templates_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "artifact_template_versions"
  ADD CONSTRAINT "artifact_template_versions_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "artifact_templates"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "artifact_template_versions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "artifact_template_versions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "report_templates" ADD COLUMN "artifact_template_id" UUID;
ALTER TABLE "checklist_templates" ADD COLUMN "artifact_template_id" UUID;
CREATE INDEX "report_templates_artifact_template_id_idx"
  ON "report_templates"("artifact_template_id");
CREATE INDEX "checklist_templates_artifact_template_id_idx"
  ON "checklist_templates"("artifact_template_id");
ALTER TABLE "report_templates"
  ADD CONSTRAINT "report_templates_artifact_template_id_fkey"
  FOREIGN KEY ("artifact_template_id") REFERENCES "artifact_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "checklist_templates"
  ADD CONSTRAINT "checklist_templates_artifact_template_id_fkey"
  FOREIGN KEY ("artifact_template_id") REFERENCES "artifact_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate every legacy logical report template into one canonical aggregate.
WITH roots AS (
  SELECT DISTINCT ON (organization_id, key)
    id, organization_id, key, name, description, report_kind, is_active,
    version, created_at, updated_at
  FROM report_templates
  WHERE deleted_at IS NULL
  ORDER BY organization_id, key, version ASC
), latest AS (
  SELECT organization_id, key, MAX(version) AS current_version
  FROM report_templates WHERE deleted_at IS NULL GROUP BY organization_id, key
)
INSERT INTO artifact_templates (
  id, organization_id, created_by_id, key, name, description, artifact_type,
  status, visibility, current_version, source, created_at, updated_at
)
SELECT roots.id, roots.organization_id, organizations.owner_user_id,
  'REPORT_' || roots.key, roots.name, roots.description, roots.report_kind,
  CASE WHEN roots.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END,
  'ORGANIZATION', latest.current_version, 'REPORT_TEMPLATE_MIGRATION',
  roots.created_at, roots.updated_at
FROM roots
JOIN latest USING (organization_id, key)
JOIN organizations ON organizations.id = roots.organization_id;

INSERT INTO artifact_template_versions (
  id, template_id, organization_id, created_by_id, version, metadata,
  sections, signature_slots, layout, change_summary, created_at
)
SELECT report.id, root.id, report.organization_id, organizations.owner_user_id,
  report.version,
  jsonb_build_object('legacyReportTemplateId', report.id,
    'legacyReportKind', report.report_kind),
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', section->>'key', 'title', section->>'title',
    'description', NULL, 'order', COALESCE((section->>'order')::int, 0),
    'type', 'LEGACY_DOCUMENT_BLOCK', 'required', false,
    'visibility', 'VISIBLE', 'permissions', '[]'::jsonb,
    'collapsible', false, 'configuration', section, 'fields', '[]'::jsonb
  ) ORDER BY COALESCE((section->>'order')::int, 0))
  FROM jsonb_array_elements(report.sections) AS section), '[]'::jsonb),
  report.signature_slots, report.settings,
  'Migrated from ReportTemplate', report.created_at
FROM report_templates report
JOIN report_templates root ON root.organization_id = report.organization_id
  AND root.key = report.key AND root.id = (
    SELECT r2.id FROM report_templates r2
    WHERE r2.organization_id = report.organization_id AND r2.key = report.key
      AND r2.deleted_at IS NULL ORDER BY r2.version ASC LIMIT 1
  )
JOIN organizations ON organizations.id = report.organization_id
WHERE report.deleted_at IS NULL;

UPDATE report_templates report SET artifact_template_id = root.id
FROM report_templates root
WHERE root.organization_id = report.organization_id AND root.key = report.key
  AND root.id = (
    SELECT r2.id FROM report_templates r2
    WHERE r2.organization_id = report.organization_id AND r2.key = report.key
      AND r2.deleted_at IS NULL ORDER BY r2.version ASC LIMIT 1
  );

-- Checklist definitions are migrated as generic form sections. Execution and
-- validation remain on the legacy engine until the future Execution Engine.
WITH roots AS (
  SELECT DISTINCT ON (organization_id, key)
    id, organization_id, key, name, description, is_active, created_at, updated_at
  FROM checklist_templates WHERE deleted_at IS NULL
  ORDER BY organization_id, key, version ASC
), latest AS (
  SELECT organization_id, key, MAX(version) AS current_version
  FROM checklist_templates WHERE deleted_at IS NULL GROUP BY organization_id, key
)
INSERT INTO artifact_templates (
  id, organization_id, created_by_id, key, name, description, artifact_type,
  status, visibility, current_version, source, created_at, updated_at
)
SELECT roots.id, roots.organization_id, organizations.owner_user_id,
  'CHECKLIST_' || roots.key, roots.name, roots.description, 'CHECKLIST',
  CASE WHEN roots.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END,
  'ORGANIZATION', latest.current_version, 'CHECKLIST_TEMPLATE_MIGRATION',
  roots.created_at, roots.updated_at
FROM roots
JOIN latest USING (organization_id, key)
JOIN organizations ON organizations.id = roots.organization_id;

INSERT INTO artifact_template_versions (
  id, template_id, organization_id, created_by_id, version, metadata,
  sections, signature_slots, layout, change_summary, created_at
)
SELECT checklist.id, root.id, checklist.organization_id,
  organizations.owner_user_id, checklist.version,
  jsonb_build_object('legacyChecklistTemplateId', checklist.id),
  jsonb_build_array(jsonb_build_object(
    'id', 'checklist', 'title', checklist.name,
    'description', checklist.description, 'order', 0, 'type', 'FORM',
    'required', true, 'visibility', 'VISIBLE', 'permissions', '[]'::jsonb,
    'collapsible', false, 'configuration', '{}'::jsonb,
    'fields', COALESCE(checklist.items, '[]'::jsonb)
  )), '[]'::jsonb, '{}'::jsonb,
  'Migrated from ChecklistTemplate', checklist.created_at
FROM checklist_templates checklist
JOIN checklist_templates root ON root.organization_id = checklist.organization_id
  AND root.key = checklist.key AND root.id = (
    SELECT c2.id FROM checklist_templates c2
    WHERE c2.organization_id = checklist.organization_id
      AND c2.key = checklist.key AND c2.deleted_at IS NULL
    ORDER BY c2.version ASC LIMIT 1
  )
JOIN organizations ON organizations.id = checklist.organization_id
WHERE checklist.deleted_at IS NULL;

UPDATE checklist_templates checklist SET artifact_template_id = root.id
FROM checklist_templates root
WHERE root.organization_id = checklist.organization_id
  AND root.key = checklist.key AND root.id = (
    SELECT c2.id FROM checklist_templates c2
    WHERE c2.organization_id = checklist.organization_id
      AND c2.key = checklist.key AND c2.deleted_at IS NULL
    ORDER BY c2.version ASC LIMIT 1
  );

-- RLS: tenants may read their own definitions and future global catalog
-- templates. Only platform administration may write global definitions.
ALTER TABLE "artifact_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "artifact_templates" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_templates_read" ON "artifact_templates"
  FOR SELECT USING (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
    OR (organization_id IS NULL AND visibility = 'GLOBAL' AND deleted_at IS NULL)
  );
CREATE POLICY "artifact_templates_write" ON "artifact_templates"
  FOR ALL USING (
    app_is_platform_admin() OR organization_id = app_current_organization_id()
  ) WITH CHECK (
    app_is_platform_admin() OR organization_id = app_current_organization_id()
  );

ALTER TABLE "artifact_template_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "artifact_template_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_template_versions_read" ON "artifact_template_versions"
  FOR SELECT USING (
    app_is_platform_admin()
    OR organization_id = app_current_organization_id()
    OR EXISTS (
      SELECT 1 FROM artifact_templates template
      WHERE template.id = artifact_template_versions.template_id
        AND template.organization_id IS NULL
        AND template.visibility = 'GLOBAL'
        AND template.deleted_at IS NULL
    )
  );
CREATE POLICY "artifact_template_versions_write" ON "artifact_template_versions"
  FOR ALL USING (
    app_is_platform_admin() OR organization_id = app_current_organization_id()
  ) WITH CHECK (
    app_is_platform_admin() OR organization_id = app_current_organization_id()
  );

-- Existing active plans receive the new module capabilities. Authorization
-- still requires the matching RBAC permission on the user's roles.
UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT capability FROM unnest(
    capabilities || ARRAY['artifact_templates.read', 'artifact_templates.manage']::varchar[]
  ) capability
) WHERE is_active = true;

UPDATE roles SET permissions = ARRAY(
  SELECT DISTINCT permission FROM unnest(
    permissions || ARRAY[
      'artifact_templates.read', 'artifact_templates.create',
      'artifact_templates.update', 'artifact_templates.activate',
      'artifact_templates.duplicate', 'artifact_templates.delete'
    ]::varchar[]
  ) permission
)
WHERE deleted_at IS NULL
  AND ('*' = ANY(permissions) OR 'report_templates.read' = ANY(permissions)
    OR 'checklists.read' = ANY(permissions));
