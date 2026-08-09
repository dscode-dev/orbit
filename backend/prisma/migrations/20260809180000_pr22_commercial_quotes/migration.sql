-- Commercial Engine — orçamentos.
--
-- Proposta comercial: o que se ofereceu, por quanto, até quando. Não é pedido,
-- contrato nem documento fiscal.

CREATE TABLE "quotes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(220) NOT NULL,
    "notes" TEXT,
    "valid_until" DATE,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMPTZ(3),
    "sent_by_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decided_by_id" UUID,
    "closing_reason" VARCHAR(500),
    "expired_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "operation_id" UUID,
    "converted_at" TIMESTAMPTZ(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quote_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "catalog_item_id" UUID,
    "kind" VARCHAR(40) NOT NULL DEFAULT 'PRODUCT',
    "description" VARCHAR(255) NOT NULL,
    "sku" VARCHAR(80),
    "unit" VARCHAR(20) NOT NULL DEFAULT 'UN',
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- Numeração sequencial por organização. Duas propostas nunca compartilham
-- número: é por ele que o cliente se refere ao documento.
CREATE UNIQUE INDEX "quotes_organization_id_number_key" ON "quotes"("organization_id", "number");

-- Uma operação pertence a no máximo um orçamento.
--
-- É esta restrição que torna a conversão idempotente no banco: a segunda
-- tentativa não encontra `operation_id IS NULL` para ocupar, e a operação que
-- ela criou desaparece com o rollback da própria transação.
CREATE UNIQUE INDEX "quotes_operation_id_key" ON "quotes"("operation_id");

CREATE INDEX "quotes_org_unit_status_created_idx" ON "quotes"("organization_id", "business_unit_id", "status", "created_at");
CREATE INDEX "quotes_org_customer_created_idx" ON "quotes"("organization_id", "customer_id", "created_at");
CREATE INDEX "quotes_org_status_valid_until_idx" ON "quotes"("organization_id", "status", "valid_until");
CREATE INDEX "quote_items_quote_id_position_idx" ON "quote_items"("quote_id", "position");
CREATE INDEX "quote_items_org_catalog_item_idx" ON "quote_items"("organization_id", "catalog_item_id");

-- Integridade comercial.
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_status_valid"
  CHECK ("status" IN ('DRAFT','SENT','APPROVED','REJECTED','EXPIRED','CANCELLED'));

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_number_positive" CHECK ("number" > 0);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_subtotal_positive" CHECK ("subtotal" >= 0);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_discount_positive" CHECK ("discount" >= 0);
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_total_positive" CHECK ("total" >= 0);

-- Desconto não excede o que se está descontando, e o total é o que sobra.
-- Sem isto, um desconto maior que o subtotal produziria um orçamento de valor
-- negativo — que viraria despesa disfarçada de receita no Financeiro.
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_discount_within_subtotal" CHECK ("discount" <= "subtotal");
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_total_matches" CHECK ("total" = "subtotal" - "discount");

-- Enviado tem carimbo de envio; decidido tem carimbo de decisão.
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_sent_stamp"
  CHECK ("status" NOT IN ('SENT','APPROVED','REJECTED','EXPIRED') OR "sent_at" IS NOT NULL);
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_decided_stamp"
  CHECK ("status" NOT IN ('APPROVED','REJECTED') OR "decided_at" IS NOT NULL);

-- Converter exige ter convertido: as duas colunas andam juntas.
ALTER TABLE "quotes"
  ADD CONSTRAINT "quotes_conversion_pair"
  CHECK (("operation_id" IS NULL) = ("converted_at" IS NULL));

ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_unit_price_positive" CHECK ("unit_price" >= 0);
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_discount_positive" CHECK ("discount" >= 0);
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_total_positive" CHECK ("total" >= 0);
ALTER TABLE "quote_items"
  ADD CONSTRAINT "quote_items_kind_valid" CHECK ("kind" IN ('PRODUCT','SERVICE','PART'));

-- O total do item é aritmética, não opinião: o banco confere.
ALTER TABLE "quote_items"
  ADD CONSTRAINT "quote_items_total_matches"
  CHECK ("total" = ROUND("quantity" * "unit_price", 2) - "discount");

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Isolamento por tenant.
--
-- Orçamento é da **unidade**, como o dinheiro que ele vira: a política exige
-- organização e unidade. Itens herdam pela política do orçamento — um item
-- sozinho não significa nada, e duplicar a regra abriria espaço para as duas
-- divergirem.
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quotes_tenant_unit" ON "quotes" FOR ALL
  USING (
    app_is_platform_admin()
    OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))
  );

ALTER TABLE "quote_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quote_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "quote_items_parent" ON "quote_items" FOR ALL
  USING (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM "quotes"
       WHERE "quotes"."id" = "quote_items"."quote_id"
         AND "quotes"."organization_id" = app_current_organization_id()
         AND "quotes"."business_unit_id" = ANY(app_current_business_unit_ids())
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM "quotes"
       WHERE "quotes"."id" = "quote_items"."quote_id"
         AND "quotes"."organization_id" = app_current_organization_id()
         AND "quotes"."business_unit_id" = ANY(app_current_business_unit_ids())
    )
  );

-- Capabilities do domínio.
--
-- `quotes.read` e `quotes.manage` são independentes de `crm.read` e
-- `catalog.read`: ter a carteira de clientes ou a tabela de preços não é o
-- mesmo que poder propor um valor em nome da empresa.
UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT value FROM unnest(
    capabilities || ARRAY['quotes.read', 'quotes.manage']::varchar[]
  ) value
) WHERE is_active = true;

UPDATE roles SET permissions = ARRAY(
  SELECT DISTINCT value FROM unnest(
    permissions || ARRAY['quotes.read', 'quotes.manage']::varchar[]
  ) value
)
WHERE deleted_at IS NULL AND '*' = ANY(permissions);
