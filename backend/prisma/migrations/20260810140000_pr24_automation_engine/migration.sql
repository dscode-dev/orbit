-- Automation Engine.
--
--   Domain Event → Automation Rule → Conditions → Actions
--
-- Não há script. Uma regra é dado: gatilho conhecido, condições declarativas e
-- ações de um catálogo fechado.

CREATE TABLE "domain_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "business_unit_id" UUID,
    "type" VARCHAR(80) NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "entity_type" VARCHAR(60) NOT NULL,
    "entity_id" UUID NOT NULL,
    "payload_version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "correlation_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "business_unit_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" VARCHAR(80) NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '[]',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "automation_executions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "action_id" VARCHAR(60) NOT NULL,
    "action_type" VARCHAR(60) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduled_for" TIMESTAMPTZ(3),
    "executed_at" TIMESTAMPTZ(3),
    "result_type" VARCHAR(60),
    "result_id" UUID,
    "detail" VARCHAR(500),
    "correlation_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "domain_events_org_type_occurred_idx" ON "domain_events"("organization_id", "type", "occurred_at");
CREATE INDEX "domain_events_org_entity_idx" ON "domain_events"("organization_id", "entity_type", "entity_id");

CREATE INDEX "automation_rules_org_trigger_enabled_idx" ON "automation_rules"("organization_id", "trigger", "enabled", "deleted_at");
CREATE INDEX "automation_rules_org_unit_idx" ON "automation_rules"("organization_id", "business_unit_id");

-- A idempotência do motor, garantida pelo banco.
--
-- Uma ocorrência, uma regra, uma ação: **uma linha**. Retry da fila, job
-- devolvido por tempo limite e reprocessamento manual convergem para um efeito
-- só. Sem ela, um lembrete de seis meses viraria dois na primeira reentrega.
CREATE UNIQUE INDEX "automation_executions_event_rule_action_key"
  ON "automation_executions"("event_id", "rule_id", "action_id");

CREATE INDEX "automation_executions_org_status_idx" ON "automation_executions"("organization_id", "status", "created_at");
CREATE INDEX "automation_executions_rule_idx" ON "automation_executions"("rule_id", "created_at");

ALTER TABLE "automation_executions"
  ADD CONSTRAINT "automation_executions_status_valid"
  CHECK ("status" IN ('PENDING','RUNNING','SUCCEEDED','FAILED','SKIPPED'));

ALTER TABLE "domain_events"
  ADD CONSTRAINT "domain_events_payload_object" CHECK (jsonb_typeof("payload") = 'object');

-- Condições e ações são **listas**. Um objeto solto ou uma string aqui seria
-- uma regra que o interpretador não sabe percorrer.
ALTER TABLE "automation_rules"
  ADD CONSTRAINT "automation_rules_conditions_array" CHECK (jsonb_typeof("conditions") = 'array');
ALTER TABLE "automation_rules"
  ADD CONSTRAINT "automation_rules_actions_array" CHECK (jsonb_typeof("actions") = 'array');

-- Regra sem ação não é regra: seria um gatilho que não faz nada.
ALTER TABLE "automation_rules"
  ADD CONSTRAINT "automation_rules_actions_present" CHECK (jsonb_array_length("actions") > 0);

ALTER TABLE "domain_events" ADD CONSTRAINT "domain_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "domain_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Isolamento por tenant.
--
-- As três tabelas são **da organização**, não da unidade: uma regra pode valer
-- para a organização inteira, e um evento de uma filial precisa ser visto pelo
-- motor mesmo quando quem consulta tem escopo mais amplo. O recorte por unidade
-- é da **regra** — `business_unit_id` nulo vale para todas —, e quem impede uma
-- ação de sair do escopo é a política da tabela que a ação escreve: um lembrete
-- passa pelo `WITH CHECK` de `scheduling_events`, uma notificação pelo de
-- `notifications`. Automação nenhuma escapa do tenant por ter regra própria.
ALTER TABLE "domain_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "domain_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "domain_events_tenant" ON "domain_events" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "automation_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_rules" FORCE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_tenant" ON "automation_rules" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "automation_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_executions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "automation_executions_tenant" ON "automation_executions" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

-- Capabilities do domínio.
--
-- Automação **executa em nome da organização**: quem cria uma regra passa a
-- criar lembretes e notificações sem estar presente. Por isso as permissões vão
-- apenas a quem já administra, e não decorrem de acesso a operações ou agenda.
UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT value FROM unnest(
    capabilities || ARRAY['automations.read', 'automations.manage']::varchar[]
  ) value
) WHERE is_active = true;

UPDATE roles SET permissions = ARRAY(
  SELECT DISTINCT value FROM unnest(
    permissions || ARRAY['automations.read', 'automations.manage']::varchar[]
  ) value
)
WHERE deleted_at IS NULL AND '*' = ANY(permissions);
