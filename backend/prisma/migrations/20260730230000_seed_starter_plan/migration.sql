-- Base comercial necessária para o onboarding self-service.
-- Idempotente: preserva um plano STARTER previamente configurado.
INSERT INTO "plans" (
  "id",
  "key",
  "name",
  "description",
  "monthly_price",
  "annual_price",
  "currency",
  "capabilities",
  "limits",
  "is_active",
  "created_at",
  "updated_at"
)
VALUES (
  '0198fa00-0000-7000-8000-000000000001',
  'STARTER',
  'Starter',
  'Plano inicial para avaliação do Orbit',
  0,
  0,
  'BRL',
  ARRAY['catalog.read', 'catalog.manage', 'integrations.read']::varchar[],
  '{"users": 5, "businessUnits": 1, "integrations": 2}'::jsonb,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
