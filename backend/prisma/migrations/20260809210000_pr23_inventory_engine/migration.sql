-- Inventory Engine.
--
-- Estoque não é um número editável: o saldo é consequência de movimentações.
-- Nenhuma rota escreve quantidade — quem quiser mudar o saldo registra um
-- movimento, e o movimento fica.

CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "balance_after" DECIMAL(14,3) NOT NULL,
    "reason" VARCHAR(500),
    "notes" TEXT,
    "operation_id" UUID,
    "source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "source_entity_id" UUID,
    "transfer_id" UUID,
    "counterpart_unit_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "business_unit_id" UUID NOT NULL,
    "catalog_item_id" UUID NOT NULL,
    "on_hand" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "minimum_stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "last_movement_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- Um saldo por item por unidade. É esta unicidade que torna o `upsert` da
-- entrada seguro sob concorrência: duas entradas simultâneas do mesmo item não
-- criam duas linhas de saldo.
CREATE UNIQUE INDEX "inventory_balances_business_unit_id_catalog_item_id_key"
  ON "inventory_balances"("business_unit_id", "catalog_item_id");

CREATE INDEX "inventory_balances_org_unit_idx" ON "inventory_balances"("organization_id", "business_unit_id");
CREATE INDEX "inventory_balances_org_item_idx" ON "inventory_balances"("organization_id", "catalog_item_id");

CREATE INDEX "inventory_movements_org_unit_item_created_idx" ON "inventory_movements"("organization_id", "business_unit_id", "catalog_item_id", "created_at");
CREATE INDEX "inventory_movements_org_type_created_idx" ON "inventory_movements"("organization_id", "type", "created_at");
CREATE INDEX "inventory_movements_org_operation_idx" ON "inventory_movements"("organization_id", "operation_id");
CREATE INDEX "inventory_movements_org_source_idx" ON "inventory_movements"("organization_id", "source", "source_entity_id");
CREATE INDEX "inventory_movements_transfer_idx" ON "inventory_movements"("transfer_id");

-- Idempotência da origem automática.
--
-- A chave inclui o **item** porque uma mesma origem — uma ordem de serviço, um
-- registro de campo — costuma consumir vários materiais. A granularidade certa
-- é "esta origem, este item": repetir a chamada não duplica o consumo, e dois
-- itens diferentes da mesma origem continuam sendo dois movimentos.
--
-- Sem `source_entity_id`, não há idempotência — e é o correto: duas entradas
-- iguais digitadas por alguém são dois fatos, não um repetido.
CREATE UNIQUE INDEX "inventory_movements_source_unique"
  ON "inventory_movements"("organization_id", "source", "source_entity_id", "catalog_item_id")
  WHERE "source" <> 'MANUAL' AND "source_entity_id" IS NOT NULL;

-- Direção, quantidade e sinal.
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_type_valid"
  CHECK ("type" IN ('ENTRY','CONSUMPTION','RETURN','ADJUSTMENT_IN','ADJUSTMENT_OUT','TRANSFER_IN','TRANSFER_OUT'));

-- Quantidade é sempre positiva: quem diz se entra ou sai é `type`. Um
-- movimento negativo permitiria registrar saída como entrada de sinal trocado,
-- e a soma do livro passaria a depender de como cada linha foi digitada.
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_balance_not_negative" CHECK ("balance_after" >= 0);

-- Transferência tem duas pontas: quem tem `transfer_id` sabe com quem falou.
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_transfer_pair"
  CHECK (
    ("transfer_id" IS NULL AND "type" NOT IN ('TRANSFER_IN','TRANSFER_OUT'))
    OR ("transfer_id" IS NOT NULL AND "counterpart_unit_id" IS NOT NULL
        AND "type" IN ('TRANSFER_IN','TRANSFER_OUT'))
  );

-- Uma unidade não transfere para si mesma.
ALTER TABLE "inventory_movements"
  ADD CONSTRAINT "inventory_movements_transfer_distinct"
  CHECK ("counterpart_unit_id" IS NULL OR "counterpart_unit_id" <> "business_unit_id");

-- Estoque negativo é impossível — não "improvável".
--
-- A transação já recusa a saída pelo `UPDATE` condicional; este `CHECK` é a
-- última linha de defesa, e vale para qualquer caminho que venha a escrever na
-- tabela, inclusive um script.
ALTER TABLE "inventory_balances"
  ADD CONSTRAINT "inventory_balances_on_hand_not_negative" CHECK ("on_hand" >= 0);

ALTER TABLE "inventory_balances"
  ADD CONSTRAINT "inventory_balances_reserved_not_negative" CHECK ("reserved" >= 0);

-- Não se reserva o que não existe fisicamente.
ALTER TABLE "inventory_balances"
  ADD CONSTRAINT "inventory_balances_reserved_within_on_hand" CHECK ("reserved" <= "on_hand");

ALTER TABLE "inventory_balances"
  ADD CONSTRAINT "inventory_balances_minimum_not_negative" CHECK ("minimum_stock" >= 0);

ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento por tenant.
--
-- Estoque é da unidade, e a política exige as duas condições. É ela que faz a
-- transferência precisar de acesso às **duas** pontas: a inserção do lado que
-- recebe passa pelo `WITH CHECK` da unidade de destino.
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "inventory_movements_tenant_unit" ON "inventory_movements" FOR ALL
  USING (
    app_is_platform_admin()
    OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (organization_id = app_current_organization_id() AND business_unit_id = ANY(app_current_business_unit_ids()))
  );

ALTER TABLE "inventory_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_balances" FORCE ROW LEVEL SECURITY;
CREATE POLICY "inventory_balances_tenant_unit" ON "inventory_balances" FOR ALL
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
-- `inventory.read` e `inventory.manage` são independentes de `catalog.read`:
-- consultar a tabela de preços não é o mesmo que saber — ou mexer — no que há
-- fisicamente na prateleira de cada filial.
UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT value FROM unnest(
    capabilities || ARRAY['inventory.read', 'inventory.manage']::varchar[]
  ) value
) WHERE is_active = true;

UPDATE roles SET permissions = ARRAY(
  SELECT DISTINCT value FROM unnest(
    permissions || ARRAY['inventory.read', 'inventory.manage']::varchar[]
  ) value
)
WHERE deleted_at IS NULL AND '*' = ANY(permissions);
