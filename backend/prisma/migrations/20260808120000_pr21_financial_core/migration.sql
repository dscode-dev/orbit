-- Financial Core — entradas e saídas de dinheiro.
--
-- Não é contabilidade: sem partidas dobradas, plano de contas, conciliação
-- bancária ou apuração fiscal. O que existe é o fato financeiro.

CREATE TABLE "financial_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(40),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "financial_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "category_id" UUID,
    "type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "source_entity_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "description" VARCHAR(255) NOT NULL,
    "notes" TEXT,
    "competence_date" DATE NOT NULL,
    "due_date" DATE,
    "confirmed_at" TIMESTAMPTZ(3),
    "confirmed_by_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by_id" UUID,
    "cancel_reason" VARCHAR(500),
    "customer_id" UUID,
    "operation_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "financial_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "financial_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "auto_record_receipts" BOOLEAN NOT NULL DEFAULT true,
    "default_currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "financial_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_categories_organization_id_type_slug_key" ON "financial_categories"("organization_id", "type", "slug");
CREATE INDEX "financial_categories_organization_id_type_deleted_at_idx" ON "financial_categories"("organization_id", "type", "deleted_at");

CREATE INDEX "financial_entries_org_unit_competence_idx" ON "financial_entries"("organization_id", "business_unit_id", "competence_date", "deleted_at");
CREATE INDEX "financial_entries_org_type_status_competence_idx" ON "financial_entries"("organization_id", "type", "status", "competence_date");
CREATE INDEX "financial_entries_org_category_competence_idx" ON "financial_entries"("organization_id", "category_id", "competence_date");
CREATE INDEX "financial_entries_org_customer_idx" ON "financial_entries"("organization_id", "customer_id");
CREATE INDEX "financial_entries_org_operation_idx" ON "financial_entries"("organization_id", "operation_id");
CREATE INDEX "financial_entries_org_source_entity_idx" ON "financial_entries"("organization_id", "source", "source_entity_id");
CREATE INDEX "financial_entries_org_status_due_idx" ON "financial_entries"("organization_id", "status", "due_date");

CREATE UNIQUE INDEX "financial_settings_organization_id_key" ON "financial_settings"("organization_id");

-- Idempotência da origem automática, garantida pelo banco.
--
-- Um lançamento derivado de outro registro existe **uma vez**, mesmo sob
-- concorrência ou retry. O predicado não filtra `deleted_at` nem `status`:
-- um lançamento cancelado ainda é prova de que aquele recibo já foi
-- processado, e reprocessá-lo criaria a segunda receita que esta PR existe
-- para impedir.
CREATE UNIQUE INDEX "financial_entries_source_entity_unique"
  ON "financial_entries"("organization_id", "source", "source_entity_id")
  WHERE "source" <> 'MANUAL' AND "source_entity_id" IS NOT NULL;

-- Integridade monetária e de estado.
ALTER TABLE "financial_entries"
  ADD CONSTRAINT "financial_entries_amount_positive" CHECK ("amount" > 0);

-- O sinal é dado por `type`, nunca pelo valor: uma despesa é `EXPENSE` com
-- valor positivo, não uma receita negativa. Sem isso, somar a coluna daria um
-- resultado que depende de como cada lançamento foi digitado.
ALTER TABLE "financial_entries"
  ADD CONSTRAINT "financial_entries_type_valid" CHECK ("type" IN ('INCOME', 'EXPENSE'));

ALTER TABLE "financial_entries"
  ADD CONSTRAINT "financial_entries_status_valid" CHECK ("status" IN ('PENDING', 'CONFIRMED', 'CANCELLED'));

ALTER TABLE "financial_entries"
  ADD CONSTRAINT "financial_entries_source_valid" CHECK ("source" IN ('MANUAL', 'RECEIPT', 'QUOTE', 'SYSTEM'));

-- Confirmado tem data de confirmação; cancelado tem data de cancelamento.
-- Um estado sem o seu carimbo seria um registro que não sabe explicar quando
-- virou o que é.
ALTER TABLE "financial_entries"
  ADD CONSTRAINT "financial_entries_confirmed_stamp"
  CHECK (("status" <> 'CONFIRMED') OR ("confirmed_at" IS NOT NULL));

ALTER TABLE "financial_entries"
  ADD CONSTRAINT "financial_entries_cancelled_stamp"
  CHECK (("status" <> 'CANCELLED') OR ("cancelled_at" IS NOT NULL));

ALTER TABLE "financial_categories"
  ADD CONSTRAINT "financial_categories_type_valid" CHECK ("type" IN ('INCOME', 'EXPENSE'));

ALTER TABLE "financial_categories" ADD CONSTRAINT "financial_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "financial_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "financial_settings" ADD CONSTRAINT "financial_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Isolamento por tenant.
--
-- Categorias e configuração são da organização. **Lançamento é da unidade**:
-- a política exige as duas condições, para que alguém com acesso a uma
-- unidade não leia o caixa de outra.
ALTER TABLE "financial_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_categories" FORCE ROW LEVEL SECURITY;
CREATE POLICY "financial_categories_tenant" ON "financial_categories" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "financial_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "financial_settings_tenant" ON "financial_settings" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "financial_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "financial_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "financial_entries_tenant_unit" ON "financial_entries" FOR ALL
  USING (
    app_is_platform_admin()
    OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))
  );

-- Capabilities do domínio.
--
-- `financial.read` e `financial.manage` são concedidas aos planos existentes.
-- Elas são **independentes** de `operations.read` e `crm.read`: quem enxerga a
-- operação não passa a enxergar o dinheiro dela.
UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT value FROM unnest(
    capabilities || ARRAY['financial.read', 'financial.manage']::varchar[]
  ) value
) WHERE is_active = true;

-- Permissões só para quem já administra a organização.
--
-- Deliberadamente **não** concedidas a papéis operacionais: quem atende a
-- ordem de serviço não passa a ver o faturamento por causa dela. Papel
-- financeiro sem administração é criado pelo Owner, que é quem decide quem
-- cuida do dinheiro.
UPDATE roles SET permissions = ARRAY(
  SELECT DISTINCT value FROM unnest(
    permissions || ARRAY['financial.read', 'financial.manage']::varchar[]
  ) value
)
WHERE deleted_at IS NULL AND '*' = ANY(permissions);
