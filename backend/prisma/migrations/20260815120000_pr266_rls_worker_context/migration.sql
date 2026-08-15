-- ORBIT V2 — PR-26.6 — RLS & Worker Context Hardening
--
-- Duas coisas, e elas dependem uma da outra:
--
--  1. o escopo de um job passa a ser **explícito** — `BUSINESS_UNIT` com uma
--     unidade, ou `ORGANIZATION` com a lista de unidades resolvida na hora do
--     pedido. `business_unit_id IS NULL` deixa de significar, ao mesmo tempo,
--     "nenhuma unidade" e "todas";
--
--  2. o worker ganha um predicado próprio para operar a fila, porque só com um
--     papel restrito o problema aparece: `background_jobs` isola por
--     organização, e quem reivindica ainda não sabe de que organização é o job.
--
-- A revisão PR-26.5 mediu o estrago do item 1: sob papel não-superusuário, um
-- job de relatório sem unidade abre contexto com `app.business_unit_ids` vazio
-- e toda tabela recortada por unidade devolve zero linha. O relatório fecha
-- `READY`, com hash válido e números zerados.

-- ---------------------------------------------------------------------------
-- 1. O worker declara-se ao operar a fila
-- ---------------------------------------------------------------------------
--
-- Isto **não** é administrador da plataforma: `app_is_job_worker()` aparece em
-- uma única política, a de `background_jobs`, e não abre nenhuma outra tabela.
-- Reivindicar é um ato de escalonador — precisa enxergar a fila inteira para
-- descobrir de quem é o próximo trabalho. A partir daí o worker reabre o
-- contexto do tenant dono do job e volta a ser um inquilino como qualquer
-- outro.

CREATE OR REPLACE FUNCTION app_is_job_worker()
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.job_worker', true), '')::boolean,
    false
  )
$$;

DROP POLICY IF EXISTS background_jobs_tenant ON background_jobs;
CREATE POLICY background_jobs_tenant ON background_jobs
  FOR ALL
  USING (
    app_is_platform_admin()
    OR app_is_job_worker()
    OR organization_id = app_current_organization_id()
  )
  WITH CHECK (
    app_is_platform_admin()
    OR app_is_job_worker()
    OR organization_id = app_current_organization_id()
  );

-- ---------------------------------------------------------------------------
-- 2. Escopo explícito no job
-- ---------------------------------------------------------------------------

ALTER TABLE background_jobs
  ADD COLUMN IF NOT EXISTS scope varchar(20),
  ADD COLUMN IF NOT EXISTS business_unit_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

-- Legado: hoje o único produtor de job sem unidade é o Management Reports, e
-- todos os 322 registros nessa condição já terminaram (`SUCCEEDED`/`DEAD`).
-- Nenhum job pendente herda escopo vazio — mas a coluna precisa ser coerente
-- para a restrição abaixo passar.
UPDATE background_jobs
SET scope = CASE
      WHEN business_unit_id IS NULL THEN 'ORGANIZATION'
      ELSE 'BUSINESS_UNIT'
    END,
    business_unit_ids = CASE
      WHEN business_unit_id IS NULL THEN ARRAY[]::uuid[]
      ELSE ARRAY[business_unit_id]
    END
WHERE scope IS NULL;

ALTER TABLE background_jobs
  ALTER COLUMN scope SET NOT NULL;

-- O contrato impossível deixa de ser representável.
--
-- `BUSINESS_UNIT` exige a unidade, e a lista declarada ao Postgres é
-- exatamente ela — não há como enfileirar uma unidade e escopar outra.
-- `ORGANIZATION` exige a ausência da unidade singular. A lista resolvida só
-- pode estar vazia nos registros legados; o worker recusa executá-los em vez
-- de compor zeros (ver `background-job.worker.ts`).
ALTER TABLE background_jobs
  DROP CONSTRAINT IF EXISTS background_jobs_scope_check;
ALTER TABLE background_jobs
  ADD CONSTRAINT background_jobs_scope_check CHECK (
    (
      scope = 'BUSINESS_UNIT'
      AND business_unit_id IS NOT NULL
      AND business_unit_ids = ARRAY[business_unit_id]
    )
    OR (scope = 'ORGANIZATION' AND business_unit_id IS NULL)
  );

-- Sem default: quem enfileira declara o escopo. Um default silencioso traria
-- de volta exatamente a ambiguidade que esta migração remove.
ALTER TABLE background_jobs
  ALTER COLUMN business_unit_ids DROP DEFAULT;

COMMENT ON COLUMN background_jobs.scope IS
  'BUSINESS_UNIT (business_unit_id obrigatório) ou ORGANIZATION (business_unit_ids resolvido no pedido).';
COMMENT ON COLUMN background_jobs.business_unit_ids IS
  'Unidades que o worker declara ao Postgres. Em BUSINESS_UNIT espelha business_unit_id; em ORGANIZATION carrega o escopo do solicitante.';
