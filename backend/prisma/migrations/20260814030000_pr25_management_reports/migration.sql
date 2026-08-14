-- PR-25 — Management Reports & Insights Engine
--
-- Um relatório gerencial é um **snapshot**: os números do momento em que foi
-- gerado, com os parâmetros que o produziram e o hash do que foi composto.
-- Consultar um relatório antigo não recalcula nada.
--
-- Por que uma tabela nova e não `reports`: `reports` é o relatório operacional
-- de visita (PR-08/09) — pertence a uma operação, tem seções preenchidas por
-- alguém e coleta assinatura. Um relatório gerencial não tem operação, não é
-- preenchido e não é assinado. Compartilhar a tabela obrigaria metade das
-- colunas a serem nulas e a capability de uma a valer para a outra.

CREATE TABLE "management_reports" (
  "id"               UUID         NOT NULL,
  "organization_id"  UUID         NOT NULL,
  "business_unit_id" UUID,
  "type"             VARCHAR(60)  NOT NULL,
  "schema_version"   INTEGER      NOT NULL DEFAULT 1,
  "status"           VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
  "format"           VARCHAR(20)  NOT NULL DEFAULT 'PDF',
  "parameters"       JSONB        NOT NULL DEFAULT '{}',
  "parameters_hash"  CHAR(64)     NOT NULL,
  "data"             JSONB,
  "source_hash"      CHAR(64),
  "provenance"       JSONB        NOT NULL DEFAULT '[]',
  "timezone"         VARCHAR(64)  NOT NULL,
  "period_from"      TIMESTAMPTZ(3) NOT NULL,
  "period_to"        TIMESTAMPTZ(3) NOT NULL,
  "generated_at"     TIMESTAMPTZ(3),
  "generated_by_id"  UUID         NOT NULL,
  "file_id"          UUID,
  "renderer"         VARCHAR(80),
  "error"            VARCHAR(500),
  "attempts"         INTEGER      NOT NULL DEFAULT 0,
  "correlation_id"   VARCHAR(64)  NOT NULL,
  "created_at"       TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"       TIMESTAMPTZ(3) NOT NULL,
  "deleted_at"       TIMESTAMPTZ(3),

  CONSTRAINT "management_reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "management_reports"
  ADD CONSTRAINT "management_reports_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "management_reports"
  ADD CONSTRAINT "management_reports_business_unit_id_fkey"
  FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "management_reports"
  ADD CONSTRAINT "management_reports_generated_by_id_fkey"
  FOREIGN KEY ("generated_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- `RESTRICT`: o arquivo de um relatório emitido não some enquanto o relatório
-- o referencia. Um relatório READY que aponta para nada seria pior que um
-- arquivo órfão.
ALTER TABLE "management_reports"
  ADD CONSTRAINT "management_reports_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "storage_files"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

/* ------------------------------------------------------------------ */
/* Índices — cada um responde a uma consulta desta PR                  */
/* ------------------------------------------------------------------ */

-- Histórico por tipo: a aba "Financeiro" do Reports Center.
CREATE INDEX "management_reports_org_type_idx"
  ON "management_reports"("organization_id", "type", "created_at" DESC);

-- Filtro por situação: "o que ainda está gerando", "o que falhou".
CREATE INDEX "management_reports_org_status_idx"
  ON "management_reports"("organization_id", "status", "created_at" DESC);

-- Recorte por unidade.
CREATE INDEX "management_reports_org_unit_idx"
  ON "management_reports"("organization_id", "business_unit_id", "created_at" DESC);

-- Filtro por autor.
CREATE INDEX "management_reports_org_author_idx"
  ON "management_reports"("organization_id", "generated_by_id", "created_at" DESC);

/**
 * Uma solicitação em andamento por recorte.
 *
 * Dois cliques no mesmo botão, ou duas abas do mesmo usuário, produziriam dois
 * relatórios idênticos — e duas composições, dois PDFs e dois arquivos no
 * storage. O índice parcial faz o segundo `INSERT` conflitar, e o serviço
 * devolve o que já está em andamento.
 *
 * Só vale enquanto está em andamento: gerar de novo **depois** de pronto é
 * legítimo — é o que se faz quando os dados mudaram e se quer o retrato novo.
 */
CREATE UNIQUE INDEX "management_reports_inflight_unique"
  ON "management_reports"("organization_id", "type", "parameters_hash")
  WHERE "status" IN ('PENDING', 'GENERATING') AND "deleted_at" IS NULL;

/* ------------------------------------------------------------------ */
/* Invariantes                                                         */
/* ------------------------------------------------------------------ */

ALTER TABLE "management_reports"
  ADD CONSTRAINT "management_reports_status_valid"
  CHECK ("status" IN ('PENDING', 'GENERATING', 'READY', 'FAILED'));

ALTER TABLE "management_reports"
  ADD CONSTRAINT "management_reports_period_ordered"
  CHECK ("period_from" <= "period_to");

-- Pronto significa **composto**: sem snapshot e sem hash não há relatório, só
-- uma linha dizendo que houve. A checagem é por instrução, e a transição para
-- READY grava `data`, `source_hash` e `generated_at` de uma vez.
ALTER TABLE "management_reports"
  ADD CONSTRAINT "management_reports_ready_has_snapshot"
  CHECK (
    "status" <> 'READY'
    OR ("data" IS NOT NULL AND "source_hash" IS NOT NULL AND "generated_at" IS NOT NULL)
  );

ALTER TABLE "management_reports"
  ADD CONSTRAINT "management_reports_provenance_is_array"
  CHECK (jsonb_typeof("provenance") = 'array');

ALTER TABLE "management_reports"
  ADD CONSTRAINT "management_reports_parameters_is_object"
  CHECK (jsonb_typeof("parameters") = 'object');

/* ------------------------------------------------------------------ */
/* RLS                                                                 */
/* ------------------------------------------------------------------ */

ALTER TABLE "management_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "management_reports" FORCE ROW LEVEL SECURITY;

/**
 * Isolamento por organização, e **não** por unidade.
 *
 * Um relatório de organização inteira tem `business_unit_id` nulo, e uma
 * política por unidade o esconderia de todo mundo. O recorte por unidade é do
 * conteúdo — quem gera escolhe a unidade, e o filtro de listagem respeita o
 * que a sessão enxerga.
 */
CREATE POLICY "management_reports_tenant" ON "management_reports" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

/* ------------------------------------------------------------------ */
/* Capabilities e permissões                                           */
/* ------------------------------------------------------------------ */

/**
 * `reports.management.*`, e não `reports.*`.
 *
 * `reports.read` já existe e pertence ao relatório **operacional de visita**
 * (PR-08/09). Reaproveitá-la faria quem lê o relatório de uma visita ler
 * também o relatório gerencial financeiro da organização — exatamente o
 * contorno que esta PR precisa impedir.
 *
 * E a capability de relatório gerencial **não substitui** a do domínio: o
 * relatório financeiro exige `financial.read` além desta, conferido na
 * geração e na leitura do snapshot.
 */
UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT value FROM unnest(
    capabilities || ARRAY['reports.management.read', 'reports.management.manage']::varchar[]
  ) value
) WHERE is_active = true;

UPDATE roles SET permissions = ARRAY(
  SELECT DISTINCT value FROM unnest(
    permissions || ARRAY['reports.management.read', 'reports.management.manage']::varchar[]
  ) value
)
WHERE deleted_at IS NULL AND '*' = ANY(permissions);
