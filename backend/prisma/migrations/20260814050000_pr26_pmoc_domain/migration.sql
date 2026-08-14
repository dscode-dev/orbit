-- PR-26 — PMOC Domain & Compliance Engine
--
-- Até aqui, "PMOC" no Orbit era **um tipo de documento**: um template oficial
-- (`ORBIT_PMOC`) e as execuções dele. Isso responde "este PDF foi preenchido?",
-- e não responde a pergunta que a operação faz todo mês: "quais equipamentos
-- estão cobertos, quando é a próxima manutenção, e o que já venceu?".
--
-- Esta migração cria o domínio que responde:
--
--   PmocPlan ──▶ PmocEquipmentCoverage ──▶ Asset
--        │
--        └────▶ PmocExecution (ciclo) ──▶ Operation + ArtifactExecution
--
-- O documento continua sendo do Artifact Engine. O plano é o compromisso; a
-- execução de artefato é a evidência de que ele foi cumprido.

CREATE TABLE "pmoc_plans" (
  "id"                    UUID         NOT NULL,
  "organization_id"       UUID         NOT NULL,
  "business_unit_id"      UUID         NOT NULL,
  "customer_id"           UUID         NOT NULL,
  "code"                  VARCHAR(60)  NOT NULL,
  "name"                  VARCHAR(220) NOT NULL,
  "status"                VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
  "notes"                 TEXT,
  "starts_on"             DATE         NOT NULL,
  "ends_on"               DATE,
  "frequency_amount"      INTEGER      NOT NULL,
  "frequency_unit"        VARCHAR(10)  NOT NULL,
  "due_soon_days"         INTEGER      NOT NULL DEFAULT 15,
  "technician_user_id"    UUID,
  "last_executed_at"      TIMESTAMPTZ(3),
  "next_due_on"           DATE,
  "due_soon_notified_for" DATE,
  "overdue_notified_for"  DATE,
  "activated_at"          TIMESTAMPTZ(3),
  "created_by_id"         UUID         NOT NULL,
  "created_at"            TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ(3) NOT NULL,
  "deleted_at"            TIMESTAMPTZ(3),

  CONSTRAINT "pmoc_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pmoc_equipment_coverages" (
  "id"              UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "plan_id"         UUID NOT NULL,
  "asset_id"        UUID NOT NULL,
  "starts_on"       DATE NOT NULL,
  "ends_on"         DATE,
  "notes"           VARCHAR(500),
  "created_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ(3) NOT NULL,
  "deleted_at"      TIMESTAMPTZ(3),

  CONSTRAINT "pmoc_equipment_coverages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pmoc_executions" (
  "id"                    UUID        NOT NULL,
  "organization_id"       UUID        NOT NULL,
  "plan_id"               UUID        NOT NULL,
  "due_on"                DATE        NOT NULL,
  "status"                VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "operation_id"          UUID,
  "artifact_execution_id" UUID,
  "scheduling_event_id"   UUID,
  "performed_at"          TIMESTAMPTZ(3),
  "completed_by_id"       UUID,
  "notes"                 VARCHAR(500),
  "created_at"            TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "updated_at"            TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "pmoc_executions_pkey" PRIMARY KEY ("id")
);

/* ------------------------------------------------------------------ */
/* Chaves                                                              */
/* ------------------------------------------------------------------ */

ALTER TABLE "pmoc_plans"
  ADD CONSTRAINT "pmoc_plans_organization_id_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_plans_business_unit_id_fkey" FOREIGN KEY ("business_unit_id")
  REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_plans_customer_id_fkey" FOREIGN KEY ("customer_id")
  REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_plans_technician_user_id_fkey" FOREIGN KEY ("technician_user_id")
  REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id")
  REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pmoc_equipment_coverages"
  ADD CONSTRAINT "pmoc_equipment_coverages_organization_id_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_equipment_coverages_plan_id_fkey" FOREIGN KEY ("plan_id")
  REFERENCES "pmoc_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_equipment_coverages_asset_id_fkey" FOREIGN KEY ("asset_id")
  REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pmoc_executions"
  ADD CONSTRAINT "pmoc_executions_organization_id_fkey" FOREIGN KEY ("organization_id")
  REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_executions_plan_id_fkey" FOREIGN KEY ("plan_id")
  REFERENCES "pmoc_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_executions_operation_id_fkey" FOREIGN KEY ("operation_id")
  REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_executions_artifact_execution_id_fkey" FOREIGN KEY ("artifact_execution_id")
  REFERENCES "artifact_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_executions_scheduling_event_id_fkey" FOREIGN KEY ("scheduling_event_id")
  REFERENCES "scheduling_events"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "pmoc_executions_completed_by_id_fkey" FOREIGN KEY ("completed_by_id")
  REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/* ------------------------------------------------------------------ */
/* Unicidade e integridade                                             */
/* ------------------------------------------------------------------ */

-- Código legível, único por organização enquanto o plano existir.
CREATE UNIQUE INDEX "pmoc_plans_code_unique_active"
  ON "pmoc_plans"("organization_id", "code")
  WHERE "deleted_at" IS NULL;

/**
 * Um equipamento não entra duas vezes no mesmo plano.
 *
 * Duas coberturas do mesmo ativo produziriam duas linhas na lista, duas contas
 * no relatório e nenhuma forma de dizer qual vale. Reincluir depois de remover
 * é legítimo — por isso o índice ignora o que foi removido.
 */
CREATE UNIQUE INDEX "pmoc_coverage_unique_active"
  ON "pmoc_equipment_coverages"("plan_id", "asset_id")
  WHERE "deleted_at" IS NULL;

/**
 * Um ciclo por vencimento.
 *
 * É o que impede duas ordens de serviço para a mesma manutenção quando a
 * rolagem for disparada duas vezes — por retry da fila ou por dois cliques.
 */
CREATE UNIQUE INDEX "pmoc_executions_cycle_unique"
  ON "pmoc_executions"("plan_id", "due_on")
  WHERE "status" <> 'CANCELLED';

CREATE UNIQUE INDEX "pmoc_executions_operation_unique"
  ON "pmoc_executions"("operation_id") WHERE "operation_id" IS NOT NULL;
CREATE UNIQUE INDEX "pmoc_executions_artifact_unique"
  ON "pmoc_executions"("artifact_execution_id") WHERE "artifact_execution_id" IS NOT NULL;
CREATE UNIQUE INDEX "pmoc_executions_scheduling_unique"
  ON "pmoc_executions"("scheduling_event_id") WHERE "scheduling_event_id" IS NOT NULL;

CREATE INDEX "pmoc_plans_org_status_due_idx"
  ON "pmoc_plans"("organization_id", "status", "next_due_on");
CREATE INDEX "pmoc_plans_org_unit_idx"
  ON "pmoc_plans"("organization_id", "business_unit_id", "status");
CREATE INDEX "pmoc_plans_org_customer_idx"
  ON "pmoc_plans"("organization_id", "customer_id");
CREATE INDEX "pmoc_coverage_org_plan_idx"
  ON "pmoc_equipment_coverages"("organization_id", "plan_id");
CREATE INDEX "pmoc_coverage_org_asset_idx"
  ON "pmoc_equipment_coverages"("organization_id", "asset_id");
CREATE INDEX "pmoc_executions_org_plan_due_idx"
  ON "pmoc_executions"("organization_id", "plan_id", "due_on");
CREATE INDEX "pmoc_executions_org_status_due_idx"
  ON "pmoc_executions"("organization_id", "status", "due_on");

ALTER TABLE "pmoc_plans"
  ADD CONSTRAINT "pmoc_plans_status_valid"
  CHECK ("status" IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED'));

ALTER TABLE "pmoc_plans"
  ADD CONSTRAINT "pmoc_plans_frequency_valid"
  CHECK (
    "frequency_amount" > 0
    AND "frequency_amount" <= 120
    AND "frequency_unit" IN ('DAYS', 'WEEKS', 'MONTHS', 'YEARS')
  );

-- Vigência: o fim nunca antes do início. A checagem é do banco porque a data
-- também chega por rolagem automática, não só pelo formulário.
ALTER TABLE "pmoc_plans"
  ADD CONSTRAINT "pmoc_plans_validity_ordered"
  CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");

ALTER TABLE "pmoc_plans"
  ADD CONSTRAINT "pmoc_plans_due_soon_window"
  CHECK ("due_soon_days" >= 1 AND "due_soon_days" <= 365);

ALTER TABLE "pmoc_equipment_coverages"
  ADD CONSTRAINT "pmoc_coverage_validity_ordered"
  CHECK ("ends_on" IS NULL OR "ends_on" >= "starts_on");

ALTER TABLE "pmoc_executions"
  ADD CONSTRAINT "pmoc_executions_status_valid"
  CHECK ("status" IN ('PENDING', 'COMPLETED', 'CANCELLED'));

-- Concluído significa **quando**: sem data de execução não há o que datar a
-- próxima manutenção, e a rolagem da periodicidade partiria do nada.
ALTER TABLE "pmoc_executions"
  ADD CONSTRAINT "pmoc_executions_completed_has_date"
  CHECK ("status" <> 'COMPLETED' OR "performed_at" IS NOT NULL);

/* ------------------------------------------------------------------ */
/* RLS                                                                 */
/* ------------------------------------------------------------------ */

ALTER TABLE "pmoc_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmoc_plans" FORCE ROW LEVEL SECURITY;

/**
 * Organização **e** unidade.
 *
 * Diferente dos relatórios gerenciais, todo plano pertence a uma unidade — não
 * existe plano "da organização inteira", porque quem executa a manutenção é uma
 * equipe de uma filial. Por isso a política também recorta por unidade, como
 * fazem operações e estoque.
 */
CREATE POLICY "pmoc_plans_unit_isolation" ON "pmoc_plans" FOR ALL
  USING (
    app_is_platform_admin()
    OR (
      organization_id = app_current_organization_id()
      AND business_unit_id = ANY (app_current_business_unit_ids())
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (
      organization_id = app_current_organization_id()
      AND business_unit_id = ANY (app_current_business_unit_ids())
    )
  );

ALTER TABLE "pmoc_equipment_coverages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmoc_equipment_coverages" FORCE ROW LEVEL SECURITY;

-- A cobertura não tem unidade própria: ela herda a do plano, e o plano já é
-- filtrado. Duplicar a coluna aqui criaria a chance de as duas divergirem.
CREATE POLICY "pmoc_coverages_tenant" ON "pmoc_equipment_coverages" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "pmoc_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pmoc_executions" FORCE ROW LEVEL SECURITY;

CREATE POLICY "pmoc_executions_tenant" ON "pmoc_executions" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

/* ------------------------------------------------------------------ */
/* Capabilities e permissões                                           */
/* ------------------------------------------------------------------ */

/**
 * `pmoc.read` / `pmoc.manage`, próprias.
 *
 * Acesso a equipamento **não** implica acesso a PMOC: o plano diz o que a
 * empresa se comprometeu a manter e para quem, e é informação contratual. Pela
 * mesma razão, `pmoc.manage` não substitui `operations.manage` nem
 * `artifact_executions.manage` quando a ação cruza esses domínios — cada uma é
 * conferida no seu lugar.
 */
UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT value FROM unnest(
    capabilities || ARRAY['pmoc.read', 'pmoc.manage']::varchar[]
  ) value
) WHERE is_active = true;

UPDATE roles SET permissions = ARRAY(
  SELECT DISTINCT value FROM unnest(
    permissions || ARRAY['pmoc.read', 'pmoc.manage']::varchar[]
  ) value
)
WHERE deleted_at IS NULL AND '*' = ANY(permissions);
