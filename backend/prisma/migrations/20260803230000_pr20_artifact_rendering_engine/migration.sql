-- PR-20 — Artifact Rendering Engine. Additive only.
--
-- Duas coisas: o estado de renderização passa a ser persistido na execução
-- (até aqui o mapper devolvia `NOT_RENDERED` fixo no código), e nasce a tabela
-- genérica de jobs assíncronos.

-- O backend é a autoridade sobre este estado; nenhum cliente o escreve.
ALTER TABLE "artifact_executions"
  ADD COLUMN "render_status" VARCHAR(20) NOT NULL DEFAULT 'NOT_RENDERED',
  ADD COLUMN "render_requested_at" TIMESTAMPTZ(3),
  ADD COLUMN "render_started_at" TIMESTAMPTZ(3),
  ADD COLUMN "render_completed_at" TIMESTAMPTZ(3),
  -- Motivo em linguagem de negócio. Stack, caminho e credencial nunca chegam aqui.
  ADD COLUMN "render_error" VARCHAR(500);

ALTER TABLE "artifact_executions"
  ADD CONSTRAINT "artifact_executions_render_status_check"
  CHECK ("render_status" IN ('NOT_RENDERED','PENDING','RENDERING','READY','FAILED'));

-- Fila de trabalho assíncrono.
--
-- O Orbit não adotou fila externa. Postgres é a infraestrutura de mensageria
-- disponível, e `FOR UPDATE SKIP LOCKED` dá exclusão mútua entre réplicas sem
-- acrescentar um componente ao deploy. Genérica de propósito: renderização é o
-- primeiro uso, não o único previsto.
CREATE TABLE "background_jobs" (
  "id" UUID PRIMARY KEY,
  "organization_id" UUID NOT NULL,
  "business_unit_id" UUID,
  "queue" VARCHAR(80) NOT NULL,
  "job_key" VARCHAR(200) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(3),
  "locked_by" VARCHAR(120),
  "correlation_id" VARCHAR(64) NOT NULL,
  "actor_user_id" UUID,
  "last_error" VARCHAR(1000),
  "started_at" TIMESTAMPTZ(3),
  "finished_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "background_jobs_status_check"
    CHECK ("status" IN ('PENDING','RUNNING','SUCCEEDED','FAILED','DEAD')),
  CONSTRAINT "background_jobs_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "background_jobs_max_attempts_check" CHECK ("max_attempts" > 0),
  CONSTRAINT "background_jobs_payload_check" CHECK (jsonb_typeof("payload") = 'object')
);

-- Ordem de consumo: por fila, por elegibilidade, mais antigo primeiro.
CREATE INDEX "background_jobs_queue_status_idx"
  ON "background_jobs"("queue","status","available_at");
CREATE INDEX "background_jobs_org_queue_idx"
  ON "background_jobs"("organization_id","queue","status");

-- Idempotência.
--
-- Enfileirar o mesmo trabalho enquanto ele está pendente ou rodando não cria um
-- segundo job — o índice parcial recusa. Depois de terminado, a mesma chave
-- pode voltar: renderizar de novo é legítimo.
CREATE UNIQUE INDEX "background_jobs_pending_key"
  ON "background_jobs"("queue","job_key")
  WHERE "status" IN ('PENDING','RUNNING');

ALTER TABLE "background_jobs"
  ADD FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  ADD FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL;

-- O worker roda no contexto do tenant dono do job, não como administrador da
-- plataforma: a mesma política vale para requisição e para trabalho de fundo.
ALTER TABLE "background_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "background_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "background_jobs_tenant" ON "background_jobs" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT value FROM unnest(
    capabilities || ARRAY['artifact_rendering.render']::varchar[]
  ) value
) WHERE is_active = true;

UPDATE roles SET permissions = ARRAY(
  SELECT DISTINCT value FROM unnest(
    permissions || ARRAY['artifact_rendering.render']::varchar[]
  ) value
)
WHERE deleted_at IS NULL
  AND ('*' = ANY(permissions) OR 'artifact_manifests.issue' = ANY(permissions));
