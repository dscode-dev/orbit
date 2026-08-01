-- PR-18 — Artifact Execution Engine. Additive only; legacy executions remain.
CREATE TABLE "artifact_snapshots" (
 "id" UUID PRIMARY KEY, "organization_id" UUID NOT NULL, "template_id" UUID NOT NULL,
 "template_version_id" UUID NOT NULL, "template_version" INTEGER NOT NULL,
 "template_key" VARCHAR(100) NOT NULL, "template_name" VARCHAR(180) NOT NULL,
 "artifact_type" VARCHAR(80) NOT NULL, "segment" VARCHAR(60),
 "metadata" JSONB NOT NULL DEFAULT '{}', "sections" JSONB NOT NULL DEFAULT '[]',
 "signature_slots" JSONB NOT NULL DEFAULT '[]', "layout" JSONB NOT NULL DEFAULT '{}',
 "structure_hash" CHAR(64) NOT NULL, "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "artifact_snapshots_version_check" CHECK ("template_version" > 0),
 CONSTRAINT "artifact_snapshots_metadata_check" CHECK (jsonb_typeof("metadata") = 'object'),
 CONSTRAINT "artifact_snapshots_sections_check" CHECK (jsonb_typeof("sections") = 'array'),
 CONSTRAINT "artifact_snapshots_signatures_check" CHECK (jsonb_typeof("signature_slots") = 'array'),
 CONSTRAINT "artifact_snapshots_layout_check" CHECK (jsonb_typeof("layout") = 'object')
);

CREATE TABLE "artifact_executions" (
 "id" UUID PRIMARY KEY, "organization_id" UUID NOT NULL, "business_unit_id" UUID NOT NULL,
 "operation_id" UUID, "customer_id" UUID, "asset_id" UUID, "template_id" UUID NOT NULL,
 "snapshot_id" UUID NOT NULL, "responsible_user_id" UUID, "created_by_id" UUID NOT NULL,
 "code" VARCHAR(80) NOT NULL, "title" VARCHAR(220) NOT NULL,
 "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT', "progress" INTEGER NOT NULL DEFAULT 0,
 "scheduled_start" TIMESTAMPTZ(3), "scheduled_end" TIMESTAMPTZ(3),
 "started_at" TIMESTAMPTZ(3), "paused_at" TIMESTAMPTZ(3),
 "submitted_at" TIMESTAMPTZ(3), "approved_at" TIMESTAMPTZ(3),
 "completed_at" TIMESTAMPTZ(3), "archived_at" TIMESTAMPTZ(3),
 "notes" TEXT, "context" JSONB NOT NULL DEFAULT '{}',
 "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deleted_at" TIMESTAMPTZ(3),
 CONSTRAINT "artifact_executions_status_check" CHECK ("status" IN ('DRAFT','IN_PROGRESS','PAUSED','UNDER_REVIEW','APPROVED','COMPLETED','ARCHIVED')),
 CONSTRAINT "artifact_executions_progress_check" CHECK ("progress" BETWEEN 0 AND 100),
 CONSTRAINT "artifact_executions_schedule_check" CHECK ("scheduled_end" IS NULL OR "scheduled_start" IS NULL OR "scheduled_end" >= "scheduled_start")
);

CREATE TABLE "artifact_execution_team" (
 "execution_id" UUID NOT NULL, "user_id" UUID NOT NULL, "role" VARCHAR(60) NOT NULL DEFAULT 'MEMBER',
 "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("execution_id", "user_id")
);
CREATE TABLE "artifact_execution_responses" (
 "id" UUID PRIMARY KEY, "organization_id" UUID NOT NULL, "execution_id" UUID NOT NULL,
 "section_id" VARCHAR(120) NOT NULL, "field_id" VARCHAR(120) NOT NULL, "value" JSONB NOT NULL,
 "value_type" VARCHAR(80) NOT NULL, "unit" VARCHAR(40), "validations" JSONB NOT NULL DEFAULT '[]',
 "provenance" VARCHAR(40) NOT NULL DEFAULT 'USER', "notes" TEXT, "answered_by_id" UUID,
 "answered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "artifact_execution_responses_validations_check" CHECK (jsonb_typeof("validations") = 'array')
);
CREATE TABLE "artifact_execution_attachments" (
 "id" UUID PRIMARY KEY, "organization_id" UUID NOT NULL, "execution_id" UUID NOT NULL,
 "response_id" UUID, "section_id" VARCHAR(120), "uploaded_by_id" UUID NOT NULL,
 "kind" VARCHAR(40) NOT NULL, "file_name" VARCHAR(255) NOT NULL, "mime_type" VARCHAR(160) NOT NULL,
 "size_bytes" BIGINT NOT NULL, "storage_key" VARCHAR(500) NOT NULL, "checksum" CHAR(64),
 "metadata" JSONB NOT NULL DEFAULT '{}', "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "deleted_at" TIMESTAMPTZ(3), CONSTRAINT "artifact_execution_attachments_size_check" CHECK ("size_bytes" >= 0)
);
CREATE TABLE "artifact_execution_signatures" (
 "id" UUID PRIMARY KEY, "organization_id" UUID NOT NULL, "execution_id" UUID NOT NULL,
 "slot_id" VARCHAR(120) NOT NULL, "signer_role" VARCHAR(80) NOT NULL, "user_id" UUID,
 "signer_name" VARCHAR(180) NOT NULL, "signer_document" VARCHAR(32), "signature_data" JSONB NOT NULL,
 "signature_hash" CHAR(64) NOT NULL, "consent_text" TEXT, "geolocation" JSONB,
 "signed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revoked_at" TIMESTAMPTZ(3)
);
CREATE TABLE "artifact_execution_insights" (
 "id" UUID PRIMARY KEY, "organization_id" UUID NOT NULL, "execution_id" UUID NOT NULL,
 "kind" VARCHAR(40) NOT NULL, "severity" VARCHAR(30) NOT NULL DEFAULT 'INFO', "source" VARCHAR(80) NOT NULL,
 "title" VARCHAR(180) NOT NULL, "description" TEXT NOT NULL, "payload" JSONB NOT NULL DEFAULT '{}',
 "resolved_at" TIMESTAMPTZ(3), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "artifact_executions_organization_code_key" ON "artifact_executions"("organization_id","code");
CREATE INDEX "artifact_snapshots_org_template_version_idx" ON "artifact_snapshots"("organization_id","template_id","template_version");
CREATE INDEX "artifact_snapshots_template_version_id_idx" ON "artifact_snapshots"("template_version_id");
CREATE INDEX "artifact_executions_org_unit_status_created_idx" ON "artifact_executions"("organization_id","business_unit_id","status","created_at");
CREATE INDEX "artifact_executions_operation_idx" ON "artifact_executions"("operation_id");
CREATE INDEX "artifact_executions_customer_idx" ON "artifact_executions"("customer_id");
CREATE INDEX "artifact_executions_asset_idx" ON "artifact_executions"("asset_id");
CREATE INDEX "artifact_executions_responsible_status_idx" ON "artifact_executions"("responsible_user_id","status");
CREATE INDEX "artifact_execution_team_user_idx" ON "artifact_execution_team"("user_id","assigned_at");
CREATE UNIQUE INDEX "artifact_execution_responses_field_key" ON "artifact_execution_responses"("execution_id","section_id","field_id");
CREATE INDEX "artifact_execution_responses_org_execution_idx" ON "artifact_execution_responses"("organization_id","execution_id");
CREATE UNIQUE INDEX "artifact_execution_attachments_storage_key" ON "artifact_execution_attachments"("storage_key");
CREATE INDEX "artifact_execution_attachments_org_execution_idx" ON "artifact_execution_attachments"("organization_id","execution_id","created_at");
CREATE INDEX "artifact_execution_attachments_response_idx" ON "artifact_execution_attachments"("response_id");
CREATE UNIQUE INDEX "artifact_execution_signatures_slot_key" ON "artifact_execution_signatures"("execution_id","slot_id");
CREATE INDEX "artifact_execution_signatures_org_signed_idx" ON "artifact_execution_signatures"("organization_id","signed_at");
CREATE INDEX "artifact_execution_insights_org_execution_idx" ON "artifact_execution_insights"("organization_id","execution_id","kind","resolved_at");

ALTER TABLE "artifact_snapshots"
 ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
 ADD FOREIGN KEY ("template_id") REFERENCES "artifact_templates"("id") ON DELETE RESTRICT,
 ADD FOREIGN KEY ("template_version_id") REFERENCES "artifact_template_versions"("id") ON DELETE RESTRICT;
ALTER TABLE "artifact_executions"
 ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
 ADD FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT,
 ADD FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE SET NULL,
 ADD FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL,
 ADD FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL,
 ADD FOREIGN KEY ("template_id") REFERENCES "artifact_templates"("id") ON DELETE RESTRICT,
 ADD FOREIGN KEY ("snapshot_id") REFERENCES "artifact_snapshots"("id") ON DELETE RESTRICT,
 ADD FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
 ADD FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "artifact_execution_team" ADD FOREIGN KEY ("execution_id") REFERENCES "artifact_executions"("id") ON DELETE CASCADE, ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "artifact_execution_responses" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE, ADD FOREIGN KEY ("execution_id") REFERENCES "artifact_executions"("id") ON DELETE CASCADE, ADD FOREIGN KEY ("answered_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "artifact_execution_attachments" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE, ADD FOREIGN KEY ("execution_id") REFERENCES "artifact_executions"("id") ON DELETE CASCADE, ADD FOREIGN KEY ("response_id") REFERENCES "artifact_execution_responses"("id") ON DELETE CASCADE, ADD FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "artifact_execution_signatures" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE, ADD FOREIGN KEY ("execution_id") REFERENCES "artifact_executions"("id") ON DELETE CASCADE, ADD FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "artifact_execution_insights" ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE, ADD FOREIGN KEY ("execution_id") REFERENCES "artifact_executions"("id") ON DELETE CASCADE;

-- Every tenant-bearing table receives the same organization and business-unit isolation.
ALTER TABLE "artifact_snapshots" ENABLE ROW LEVEL SECURITY; ALTER TABLE "artifact_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_snapshots_tenant" ON "artifact_snapshots" FOR ALL USING (app_is_platform_admin() OR organization_id = app_current_organization_id()) WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());
ALTER TABLE "artifact_executions" ENABLE ROW LEVEL SECURITY; ALTER TABLE "artifact_executions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_executions_tenant_unit" ON "artifact_executions" FOR ALL USING (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))) WITH CHECK (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids())));
ALTER TABLE "artifact_execution_responses" ENABLE ROW LEVEL SECURITY; ALTER TABLE "artifact_execution_responses" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_execution_responses_tenant" ON "artifact_execution_responses" FOR ALL USING (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id))) WITH CHECK (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id)));
ALTER TABLE "artifact_execution_attachments" ENABLE ROW LEVEL SECURITY; ALTER TABLE "artifact_execution_attachments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_execution_attachments_tenant" ON "artifact_execution_attachments" FOR ALL USING (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id))) WITH CHECK (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id)));
ALTER TABLE "artifact_execution_signatures" ENABLE ROW LEVEL SECURITY; ALTER TABLE "artifact_execution_signatures" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_execution_signatures_tenant" ON "artifact_execution_signatures" FOR ALL USING (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id))) WITH CHECK (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id)));
ALTER TABLE "artifact_execution_insights" ENABLE ROW LEVEL SECURITY; ALTER TABLE "artifact_execution_insights" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_execution_insights_tenant" ON "artifact_execution_insights" FOR ALL USING (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id))) WITH CHECK (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id)));
ALTER TABLE "artifact_execution_team" ENABLE ROW LEVEL SECURITY; ALTER TABLE "artifact_execution_team" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_execution_team_tenant" ON "artifact_execution_team" FOR ALL USING (app_is_platform_admin() OR EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id)) WITH CHECK (app_is_platform_admin() OR EXISTS (SELECT 1 FROM artifact_executions e WHERE e.id = execution_id));

UPDATE plans SET capabilities = ARRAY(SELECT DISTINCT value FROM unnest(capabilities || ARRAY['artifact_executions.read','artifact_executions.manage','artifact_executions.execute']::varchar[]) value) WHERE is_active = true;
UPDATE roles SET permissions = ARRAY(SELECT DISTINCT value FROM unnest(permissions || ARRAY['artifact_executions.read','artifact_executions.create','artifact_executions.update','artifact_executions.execute','artifact_executions.review','artifact_executions.approve','artifact_executions.archive']::varchar[]) value)
WHERE deleted_at IS NULL AND ('*' = ANY(permissions) OR 'operations.read' = ANY(permissions) OR 'checklists.execute' = ANY(permissions));
