-- PR-10 / PR-11 — operational checklists and multi-channel notifications.
-- This migration is intentionally not executed by Codex.

ALTER TABLE "checklist_executions"
  ADD COLUMN "created_by_id" UUID,
  ADD COLUMN "template_version" INTEGER,
  ADD COLUMN "template_snapshot" JSONB,
  ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "notes" TEXT;

UPDATE "checklist_executions" AS execution
SET
  "created_by_id" = organization."owner_user_id",
  "template_version" = template."version",
  "template_snapshot" = jsonb_build_object(
    'key', template."key",
    'name', template."name",
    'version', template."version",
    'items', template."items"
  )
FROM "organizations" AS organization,
     "checklist_templates" AS template
WHERE organization."id" = execution."organization_id"
  AND template."id" = execution."template_id";

ALTER TABLE "checklist_executions"
  ALTER COLUMN "created_by_id" SET NOT NULL,
  ALTER COLUMN "template_version" SET NOT NULL,
  ALTER COLUMN "template_snapshot" SET NOT NULL,
  ADD CONSTRAINT "checklist_executions_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "checklist_execution_status_check"
    CHECK ("status" IN ('IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  ADD CONSTRAINT "checklist_execution_progress_check"
    CHECK ("progress" BETWEEN 0 AND 100);

CREATE INDEX "checklist_executions_created_by_id_created_at_idx"
  ON "checklist_executions"("created_by_id", "created_at");

ALTER TABLE "notifications"
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "notification_preferences" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "channels" VARCHAR(30)[] NOT NULL DEFAULT ARRAY['IN_APP', 'REALTIME']::VARCHAR(30)[],
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "quiet_hours" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_preferences_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "notification_preferences_organization_id_user_id_type_key"
  ON "notification_preferences"("organization_id", "user_id", "type");
CREATE INDEX "notification_preferences_user_id_enabled_idx"
  ON "notification_preferences"("user_id", "enabled");

CREATE TABLE "notification_deliveries" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "notification_id" UUID NOT NULL,
  "recipient_user_id" UUID NOT NULL,
  "channel" VARCHAR(30) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
  "provider" VARCHAR(60),
  "provider_message_id" VARCHAR(255),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "sent_at" TIMESTAMPTZ(3),
  "delivered_at" TIMESTAMPTZ(3),
  "failed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_deliveries_notification_id_fkey"
    FOREIGN KEY ("notification_id") REFERENCES "notifications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_deliveries_recipient_user_id_fkey"
    FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "notification_delivery_channel_check"
    CHECK ("channel" IN ('IN_APP', 'REALTIME', 'EMAIL', 'PUSH')),
  CONSTRAINT "notification_delivery_status_check"
    CHECK ("status" IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'SKIPPED')),
  CONSTRAINT "notification_delivery_attempts_check"
    CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "notification_deliveries_notification_id_channel_key"
  ON "notification_deliveries"("notification_id", "channel");
CREATE INDEX "notification_deliveries_status_created_at_idx"
  ON "notification_deliveries"("status", "created_at");
CREATE INDEX "notification_deliveries_recipient_user_id_created_at_idx"
  ON "notification_deliveries"("recipient_user_id", "created_at");

CREATE TABLE "push_subscriptions" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "endpoint" TEXT NOT NULL,
  "endpoint_hash" CHAR(64) NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "user_agent" TEXT,
  "expires_at" TIMESTAMPTZ(3),
  "last_used_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(3),
  CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_subscriptions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "push_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "push_subscriptions_organization_id_user_id_endpoint_hash_key"
  ON "push_subscriptions"("organization_id", "user_id", "endpoint_hash");
CREATE INDEX "push_subscriptions_user_id_revoked_at_idx"
  ON "push_subscriptions"("user_id", "revoked_at");

-- Notification inbox rows are private to the recipient. Users with the
-- management permission may create and dispatch notifications for the tenant.
DROP POLICY IF EXISTS "notifications_optional_unit_isolation" ON "notifications";
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
      )
      AND (
        "business_unit_id" IS NULL
        OR "business_unit_id" = ANY(app_current_business_unit_ids())
      )
    )
  );

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notification_preferences_self_isolation"
  ON "notification_preferences" FOR ALL
  USING (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND "user_id" = app_current_user_id()
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND "user_id" = app_current_user_id()
    )
  );

ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "push_subscriptions_self_isolation"
  ON "push_subscriptions" FOR ALL
  USING (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND "user_id" = app_current_user_id()
    )
  )
  WITH CHECK (
    app_is_platform_admin()
    OR (
      "organization_id" = app_current_organization_id()
      AND "user_id" = app_current_user_id()
    )
  );

ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_deliveries" FORCE ROW LEVEL SECURITY;
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
        )
    )
  );

UPDATE "plans"
SET "capabilities" = ARRAY(
  SELECT DISTINCT capability
  FROM unnest(
    "capabilities" || ARRAY[
      'checklists.read',
      'checklists.manage',
      'checklists.execute',
      'notifications.read',
      'notifications.manage'
    ]::varchar[]
  ) AS capability
)
WHERE "is_active" = true;
