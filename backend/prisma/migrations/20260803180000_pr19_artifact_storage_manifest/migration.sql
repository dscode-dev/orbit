-- PR-19 — Artifact Storage & Manifest. Additive only.
--
-- Duas tabelas novas e uma coluna em anexos. Nada é removido: os anexos
-- anteriores continuam válidos com `file_id` nulo, e nenhum contrato público
-- muda de forma.

-- Objeto binário guardado por um provider. `object_key` e `bucket` são
-- internos: nenhum Read Model os publica, e o acesso é sempre por URL assinada.
CREATE TABLE "storage_files" (
  "id" UUID PRIMARY KEY,
  "organization_id" UUID NOT NULL,
  "business_unit_id" UUID,
  "provider" VARCHAR(40) NOT NULL,
  "bucket" VARCHAR(160) NOT NULL,
  "object_key" VARCHAR(1024) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(160) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "sha256" CHAR(64),
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "storage_files_provider_check" CHECK ("provider" IN ('LOCAL','S3','MINIO','AZURE_BLOB','GCS')),
  CONSTRAINT "storage_files_status_check" CHECK ("status" IN ('PENDING','AVAILABLE','MISSING')),
  CONSTRAINT "storage_files_size_check" CHECK ("size_bytes" >= 0),
  CONSTRAINT "storage_files_metadata_check" CHECK (jsonb_typeof("metadata") = 'object'),
  -- Um objeto disponível tem sempre hash: é o hash que prova o conteúdo.
  CONSTRAINT "storage_files_available_hash_check" CHECK ("status" <> 'AVAILABLE' OR "sha256" IS NOT NULL)
);

-- Documento oficialmente emitido. Uma execução tem várias revisões; só uma
-- fica ativa, garantido pelo índice único parcial mais abaixo.
CREATE TABLE "artifact_manifests" (
  "id" UUID PRIMARY KEY,
  "organization_id" UUID NOT NULL,
  "business_unit_id" UUID NOT NULL,
  "execution_id" UUID NOT NULL,
  "snapshot_id" UUID NOT NULL,
  "template_id" UUID NOT NULL,
  "template_version" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "renderer" VARCHAR(80) NOT NULL,
  "renderer_version" VARCHAR(40),
  "format" VARCHAR(20) NOT NULL DEFAULT 'PDF',
  "content_hash" CHAR(64),
  "source_hash" CHAR(64) NOT NULL,
  "file_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "issued_at" TIMESTAMPTZ(3),
  "issued_by_id" UUID,
  "superseded_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "revoked_reason" VARCHAR(500),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "artifact_manifests_status_check" CHECK ("status" IN ('DRAFT','ISSUED','SUPERSEDED','REVOKED')),
  CONSTRAINT "artifact_manifests_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "artifact_manifests_version_check" CHECK ("template_version" > 0),
  CONSTRAINT "artifact_manifests_metadata_check" CHECK (jsonb_typeof("metadata") = 'object'),
  -- Emitido exige arquivo, hash do conteúdo e data. Rascunho não os tem.
  CONSTRAINT "artifact_manifests_issued_check" CHECK (
    "status" = 'DRAFT'
    OR ("file_id" IS NOT NULL AND "content_hash" IS NOT NULL AND "issued_at" IS NOT NULL)
  ),
  -- Rascunho e revogado nunca são a revisão ativa.
  CONSTRAINT "artifact_manifests_active_check" CHECK (
    "is_active" = false OR "status" = 'ISSUED'
  ),
  CONSTRAINT "artifact_manifests_revoked_check" CHECK (
    "status" <> 'REVOKED' OR "revoked_at" IS NOT NULL
  )
);

-- `file_id` liga o anexo ao Storage. Nulo nos anexos anteriores à PR-19, que
-- continuam válidos com a `storage_key` que o cliente informou.
ALTER TABLE "artifact_execution_attachments" ADD COLUMN "file_id" UUID;

CREATE UNIQUE INDEX "storage_files_object_key" ON "storage_files"("provider","bucket","object_key");
CREATE INDEX "storage_files_org_status_idx" ON "storage_files"("organization_id","status","created_at");

CREATE UNIQUE INDEX "artifact_manifests_revision_key" ON "artifact_manifests"("execution_id","revision");
CREATE INDEX "artifact_manifests_org_execution_idx" ON "artifact_manifests"("organization_id","execution_id","revision");
CREATE INDEX "artifact_manifests_org_status_idx" ON "artifact_manifests"("organization_id","status","issued_at");
-- "Apenas um poderá ser considerado ativo" é uma garantia do banco, não uma
-- convenção da aplicação: nenhuma corrida entre duas emissões pode furá-la.
CREATE UNIQUE INDEX "artifact_manifests_single_active"
  ON "artifact_manifests"("execution_id")
  WHERE "is_active" AND "deleted_at" IS NULL;

CREATE INDEX "artifact_execution_attachments_file_idx" ON "artifact_execution_attachments"("file_id");

ALTER TABLE "storage_files"
  ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  ADD FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL,
  ADD FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TABLE "artifact_manifests"
  ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  ADD FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT,
  ADD FOREIGN KEY ("execution_id") REFERENCES "artifact_executions"("id") ON DELETE CASCADE,
  ADD FOREIGN KEY ("snapshot_id") REFERENCES "artifact_snapshots"("id") ON DELETE RESTRICT,
  ADD FOREIGN KEY ("template_id") REFERENCES "artifact_templates"("id") ON DELETE RESTRICT,
  -- RESTRICT: um documento emitido não perde o arquivo por remoção acidental.
  ADD FOREIGN KEY ("file_id") REFERENCES "storage_files"("id") ON DELETE RESTRICT,
  ADD FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL,
  ADD FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT;

ALTER TABLE "artifact_execution_attachments"
  ADD FOREIGN KEY ("file_id") REFERENCES "storage_files"("id") ON DELETE SET NULL;

-- Isolamento por organização; o manifest isola também por unidade, como a
-- execução que o originou.
ALTER TABLE "storage_files" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storage_files" FORCE ROW LEVEL SECURITY;
CREATE POLICY "storage_files_tenant" ON "storage_files" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "artifact_manifests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "artifact_manifests" FORCE ROW LEVEL SECURITY;
CREATE POLICY "artifact_manifests_tenant_unit" ON "artifact_manifests" FOR ALL
  USING (
    app_is_platform_admin()
    OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))
  );

UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT value FROM unnest(
    capabilities || ARRAY['artifact_manifests.read','artifact_manifests.manage']::varchar[]
  ) value
) WHERE is_active = true;

UPDATE roles SET permissions = ARRAY(
  SELECT DISTINCT value FROM unnest(
    permissions || ARRAY['artifact_manifests.read','artifact_manifests.issue','artifact_manifests.revoke']::varchar[]
  ) value
)
WHERE deleted_at IS NULL
  AND ('*' = ANY(permissions) OR 'artifact_executions.read' = ANY(permissions));
