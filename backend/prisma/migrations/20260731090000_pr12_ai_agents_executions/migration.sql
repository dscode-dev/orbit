-- PR-12 — versioned AI agents, governed context and auditable executions.
-- This migration is intentionally not executed by Codex.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "ai_agents"
  ADD COLUMN "integration_id" UUID,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "ai_agents_integration_id_fkey"
    FOREIGN KEY ("integration_id") REFERENCES "integrations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX IF EXISTS "ai_agents_organization_id_key_key";
CREATE UNIQUE INDEX "ai_agents_organization_id_key_version_key"
  ON "ai_agents"("organization_id", "key", "version");
CREATE INDEX "ai_agents_integration_id_idx"
  ON "ai_agents"("integration_id");

ALTER TABLE "ai_executions"
  ADD COLUMN "customer_id" UUID,
  ADD COLUMN "operation_id" UUID,
  ADD COLUMN "report_id" UUID,
  ADD COLUMN "idempotency_key" VARCHAR(160),
  ADD COLUMN "input_hash" CHAR(64),
  ADD COLUMN "agent_snapshot" JSONB,
  ADD COLUMN "context_snapshot" JSONB,
  ADD COLUMN "output_hash" CHAR(64),
  ADD COLUMN "provider_request_id" VARCHAR(255),
  ADD COLUMN "duration_ms" INTEGER;

UPDATE "ai_executions" AS execution
SET
  "input_hash" = encode(
    digest(convert_to(COALESCE(execution."input", '{}'::jsonb)::text, 'UTF8'), 'sha256'),
    'hex'
  ),
  "agent_snapshot" = CASE
    WHEN agent."id" IS NULL THEN jsonb_build_object(
      'agentId', execution."agent_id",
      'deleted', true
    )
    ELSE jsonb_build_object(
      'agentId', agent."id",
      'key', agent."key",
      'version', agent."version",
      'provider', agent."provider",
      'model', agent."model",
      'systemPrompt', agent."system_prompt",
      'tools', agent."tools",
      'configuration', agent."configuration"
    )
  END,
  "output_hash" = CASE
    WHEN execution."output" IS NULL THEN NULL
    ELSE encode(
      digest(convert_to(execution."output"::text, 'UTF8'), 'sha256'),
      'hex'
    )
  END
FROM "ai_agents" AS agent
WHERE agent."id" IS NOT DISTINCT FROM execution."agent_id";

-- Covers historical executions whose agent reference is already NULL.
UPDATE "ai_executions"
SET
  "input_hash" = encode(
    digest(convert_to(COALESCE("input", '{}'::jsonb)::text, 'UTF8'), 'sha256'),
    'hex'
  ),
  "agent_snapshot" = jsonb_build_object('agentId', NULL, 'deleted', true),
  "output_hash" = CASE
    WHEN "output" IS NULL THEN NULL
    ELSE encode(digest(convert_to("output"::text, 'UTF8'), 'sha256'), 'hex')
  END
WHERE "input_hash" IS NULL;

ALTER TABLE "ai_executions"
  ALTER COLUMN "input_hash" SET NOT NULL,
  ALTER COLUMN "agent_snapshot" SET NOT NULL,
  ADD CONSTRAINT "ai_executions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_executions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_executions_operation_id_fkey"
    FOREIGN KEY ("operation_id") REFERENCES "operations"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_executions_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "reports"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ai_execution_status_check"
    CHECK ("status" IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
  ADD CONSTRAINT "ai_execution_token_check"
    CHECK (
      COALESCE("input_tokens", 0) >= 0
      AND COALESCE("output_tokens", 0) >= 0
    ),
  ADD CONSTRAINT "ai_execution_duration_check"
    CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0),
  ADD CONSTRAINT "ai_execution_cost_check"
    CHECK ("estimated_cost" IS NULL OR "estimated_cost" >= 0);

CREATE UNIQUE INDEX "ai_executions_idempotency_unique"
  ON "ai_executions"("organization_id", "user_id", "idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX "ai_executions_customer_id_created_at_idx"
  ON "ai_executions"("customer_id", "created_at");
CREATE INDEX "ai_executions_operation_id_created_at_idx"
  ON "ai_executions"("operation_id", "created_at");
CREATE INDEX "ai_executions_report_id_created_at_idx"
  ON "ai_executions"("report_id", "created_at");

-- AI executions may create an inbox notification for their requesting user.
DROP POLICY IF EXISTS "notifications_recipient_isolation" ON "notifications";
CREATE POLICY "notifications_recipient_isolation" ON "notifications"
  FOR ALL
  USING (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND (
        "recipient_user_id" = app_current_user_id()
        OR app_has_permission('notifications.create')
        OR app_has_permission('notifications.dispatch')
        OR app_has_permission('ai.executions.create')
      )
      AND (
        "business_unit_id" IS NULL
        OR "business_unit_id" = ANY(app_current_business_unit_ids())
      )
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND (
        "recipient_user_id" = app_current_user_id()
        OR app_has_permission('notifications.create')
        OR app_has_permission('ai.executions.create')
      )
      AND (
        "business_unit_id" IS NULL
        OR "business_unit_id" = ANY(app_current_business_unit_ids())
      )
    )
  );

DROP POLICY IF EXISTS "notification_deliveries_parent_isolation"
  ON "notification_deliveries";
CREATE POLICY "notification_deliveries_parent_isolation"
  ON "notification_deliveries" FOR ALL
  USING (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM "notifications"
      WHERE "notifications"."id" = "notification_deliveries"."notification_id"
        AND "notifications"."organization_id" = app_current_organization_id()
        AND (
          "notification_deliveries"."recipient_user_id" = app_current_user_id()
          OR app_has_permission('notifications.dispatch')
          OR app_has_permission('notifications.create')
          OR app_has_permission('ai.executions.create')
        )
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM "notifications"
      WHERE "notifications"."id" = "notification_deliveries"."notification_id"
        AND "notifications"."organization_id" = app_current_organization_id()
        AND (
          "notification_deliveries"."recipient_user_id" = app_current_user_id()
          OR app_has_permission('notifications.dispatch')
          OR app_has_permission('notifications.create')
          OR app_has_permission('ai.executions.create')
        )
    )
  );

UPDATE "plans"
SET "capabilities" = ARRAY(
  SELECT DISTINCT capability
  FROM unnest(
    "capabilities" || ARRAY[
      'ai.agents.read',
      'ai.agents.manage',
      'ai.executions.read',
      'ai.executions.run'
    ]::varchar[]
  ) AS capability
)
WHERE "is_active" = true;
