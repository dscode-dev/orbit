-- PR-14 — Scheduling Engine.
-- This migration is intentionally not executed by Codex.

CREATE TABLE "scheduling_calendars" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "organization_id" UUID NOT NULL,
  "business_unit_id" UUID,
  "key" VARCHAR(100) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "color" VARCHAR(20),
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Recife',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "scheduling_calendars_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scheduling_calendars_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scheduling_calendars_business_unit_id_fkey"
    FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "scheduling_calendars_key_unique_active"
  ON "scheduling_calendars"(
    "organization_id",
    COALESCE("business_unit_id", '00000000-0000-0000-0000-000000000000'::uuid),
    "key"
  )
  WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "scheduling_calendars_default_unique_active"
  ON "scheduling_calendars"(
    "organization_id",
    COALESCE("business_unit_id", '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE "deleted_at" IS NULL AND "is_active" = true AND "is_default" = true;
CREATE INDEX "scheduling_calendars_scope_idx"
  ON "scheduling_calendars"(
    "organization_id", "business_unit_id", "is_active", "deleted_at"
  );

CREATE TABLE "scheduling_events" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "organization_id" UUID NOT NULL,
  "business_unit_id" UUID,
  "calendar_id" UUID NOT NULL,
  "customer_id" UUID,
  "asset_id" UUID,
  "created_by_id" UUID NOT NULL,
  "title" VARCHAR(220) NOT NULL,
  "description" TEXT,
  "type" VARCHAR(60) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'CONFIRMED',
  "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "all_day" BOOLEAN NOT NULL DEFAULT false,
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Recife',
  "segment" VARCHAR(60),
  "source_module" VARCHAR(100) NOT NULL,
  "source_entity_type" VARCHAR(100) NOT NULL,
  "source_entity_id" UUID,
  "location" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "scheduling_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scheduling_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scheduling_events_business_unit_id_fkey"
    FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scheduling_events_calendar_id_fkey"
    FOREIGN KEY ("calendar_id") REFERENCES "scheduling_calendars"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "scheduling_events_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "scheduling_events_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "scheduling_events_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "scheduling_event_time_check"
    CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "scheduling_event_status_check"
    CHECK (
      "status" IN (
        'TENTATIVE', 'CONFIRMED', 'IN_PROGRESS',
        'COMPLETED', 'CANCELLED'
      )
    ),
  CONSTRAINT "scheduling_event_priority_check"
    CHECK ("priority" IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL'))
);

CREATE INDEX "scheduling_events_organization_time_idx"
  ON "scheduling_events"("organization_id", "starts_at", "ends_at");
CREATE INDEX "scheduling_events_unit_time_idx"
  ON "scheduling_events"("organization_id", "business_unit_id", "starts_at");
CREATE INDEX "scheduling_events_calendar_time_idx"
  ON "scheduling_events"("calendar_id", "starts_at");
CREATE INDEX "scheduling_events_customer_time_idx"
  ON "scheduling_events"("customer_id", "starts_at");
CREATE INDEX "scheduling_events_asset_time_idx"
  ON "scheduling_events"("asset_id", "starts_at");
CREATE INDEX "scheduling_events_source_idx"
  ON "scheduling_events"(
    "source_module", "source_entity_type", "source_entity_id"
  );

CREATE TABLE "scheduling_recurrences" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "event_id" UUID NOT NULL,
  "frequency" VARCHAR(30) NOT NULL,
  "interval" INTEGER NOT NULL DEFAULT 1,
  "by_weekday" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "by_month_day" INTEGER,
  "count" INTEGER,
  "until" TIMESTAMPTZ(3),
  "custom_rule" JSONB,
  "exceptions" TIMESTAMPTZ(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMPTZ(3)[],
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Recife',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scheduling_recurrences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scheduling_recurrences_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "scheduling_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scheduling_recurrence_frequency_check"
    CHECK ("frequency" IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
  CONSTRAINT "scheduling_recurrence_interval_check"
    CHECK ("interval" BETWEEN 1 AND 365),
  CONSTRAINT "scheduling_recurrence_weekdays_check"
    CHECK ("by_weekday" <@ ARRAY[0,1,2,3,4,5,6]::INTEGER[]),
  CONSTRAINT "scheduling_recurrence_month_day_check"
    CHECK ("by_month_day" IS NULL OR "by_month_day" BETWEEN 1 AND 31),
  CONSTRAINT "scheduling_recurrence_count_check"
    CHECK ("count" IS NULL OR "count" BETWEEN 1 AND 1000),
  CONSTRAINT "scheduling_recurrence_end_check"
    CHECK (NOT ("count" IS NOT NULL AND "until" IS NOT NULL))
);
CREATE UNIQUE INDEX "scheduling_recurrences_event_id_key"
  ON "scheduling_recurrences"("event_id");

CREATE TABLE "scheduling_resource_allocations" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "event_id" UUID NOT NULL,
  "user_id" UUID,
  "asset_id" UUID,
  "resource_type" VARCHAR(30) NOT NULL,
  "resource_key" VARCHAR(160),
  "role" VARCHAR(80),
  "status" VARCHAR(30) NOT NULL DEFAULT 'ALLOCATED',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "scheduling_resource_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scheduling_resource_allocations_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "scheduling_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scheduling_resource_allocations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "scheduling_resource_allocations_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "scheduling_allocation_type_check"
    CHECK ("resource_type" IN ('USER', 'ASSET', 'CUSTOM')),
  CONSTRAINT "scheduling_allocation_status_check"
    CHECK ("status" IN ('ALLOCATED', 'RELEASED')),
  CONSTRAINT "scheduling_allocation_identity_check"
    CHECK (
      ("resource_type" = 'USER' AND "user_id" IS NOT NULL
        AND "asset_id" IS NULL AND "resource_key" IS NULL)
      OR
      ("resource_type" = 'ASSET' AND "asset_id" IS NOT NULL
        AND "user_id" IS NULL AND "resource_key" IS NULL)
      OR
      ("resource_type" = 'CUSTOM' AND "resource_key" IS NOT NULL
        AND "user_id" IS NULL AND "asset_id" IS NULL)
    )
);
CREATE INDEX "scheduling_allocations_event_idx"
  ON "scheduling_resource_allocations"("event_id", "status", "deleted_at");
CREATE INDEX "scheduling_allocations_user_idx"
  ON "scheduling_resource_allocations"("user_id", "status");
CREATE INDEX "scheduling_allocations_asset_idx"
  ON "scheduling_resource_allocations"("asset_id", "status");
CREATE INDEX "scheduling_allocations_custom_idx"
  ON "scheduling_resource_allocations"(
    "resource_type", "resource_key", "status"
  );
CREATE UNIQUE INDEX "scheduling_allocations_resource_unique_active"
  ON "scheduling_resource_allocations"(
    "event_id", "resource_type",
    COALESCE("user_id", "asset_id"),
    COALESCE("resource_key", '')
  )
  WHERE "deleted_at" IS NULL AND "status" = 'ALLOCATED';

CREATE TABLE "scheduling_availability" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "organization_id" UUID NOT NULL,
  "business_unit_id" UUID,
  "user_id" UUID,
  "resource_type" VARCHAR(30) NOT NULL,
  "resource_key" VARCHAR(160),
  "kind" VARCHAR(30) NOT NULL,
  "day_of_week" INTEGER,
  "date" DATE,
  "start_minute" INTEGER NOT NULL,
  "end_minute" INTEGER NOT NULL,
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Recife',
  "effective_from" DATE,
  "effective_until" DATE,
  "reason" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "scheduling_availability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scheduling_availability_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scheduling_availability_business_unit_id_fkey"
    FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scheduling_availability_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scheduling_availability_type_check"
    CHECK ("resource_type" IN ('USER', 'ASSET', 'CUSTOM')),
  CONSTRAINT "scheduling_availability_kind_check"
    CHECK ("kind" IN ('AVAILABLE', 'BLOCKED')),
  CONSTRAINT "scheduling_availability_identity_check"
    CHECK (
      ("resource_type" = 'USER' AND "user_id" IS NOT NULL
        AND "resource_key" IS NULL)
      OR
      ("resource_type" IN ('ASSET', 'CUSTOM') AND "user_id" IS NULL
        AND "resource_key" IS NOT NULL)
    ),
  CONSTRAINT "scheduling_availability_period_check"
    CHECK (
      ("date" IS NOT NULL AND "day_of_week" IS NULL)
      OR ("date" IS NULL AND "day_of_week" BETWEEN 0 AND 6)
    ),
  CONSTRAINT "scheduling_availability_minutes_check"
    CHECK (
      "start_minute" BETWEEN 0 AND 1439
      AND "end_minute" BETWEEN 1 AND 1440
      AND "end_minute" > "start_minute"
    ),
  CONSTRAINT "scheduling_availability_effective_check"
    CHECK (
      "effective_from" IS NULL OR "effective_until" IS NULL
      OR "effective_until" >= "effective_from"
    )
);
CREATE INDEX "scheduling_availability_scope_idx"
  ON "scheduling_availability"(
    "organization_id", "business_unit_id", "kind", "deleted_at"
  );
CREATE INDEX "scheduling_availability_user_idx"
  ON "scheduling_availability"("user_id", "day_of_week", "date");
CREATE INDEX "scheduling_availability_resource_idx"
  ON "scheduling_availability"(
    "resource_type", "resource_key", "day_of_week", "date"
  );

CREATE TABLE "scheduling_event_history" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "event_id" UUID NOT NULL,
  "user_id" UUID,
  "action" VARCHAR(80) NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scheduling_event_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "scheduling_event_history_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "scheduling_events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "scheduling_event_history_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "scheduling_event_history_event_created_idx"
  ON "scheduling_event_history"("event_id", "created_at");

-- Calendars, events and availability may be organization-wide or scoped to a
-- business unit. NULL means organization-wide.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'scheduling_calendars',
    'scheduling_events',
    'scheduling_availability'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND (business_unit_id IS NULL OR business_unit_id = ANY(app_current_business_unit_ids())))) WITH CHECK (app_is_platform_admin() OR (organization_id = app_current_organization_id() AND (business_unit_id IS NULL OR business_unit_id = ANY(app_current_business_unit_ids()))))',
      target_table || '_optional_unit_isolation',
      target_table
    );
  END LOOP;
END
$$;

-- Child tables inherit the event scope through the parent event.
DO $$
DECLARE
  target_table text;
  event_column text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'scheduling_recurrences',
    'scheduling_resource_allocations',
    'scheduling_event_history'
  ]
  LOOP
    event_column := 'event_id';
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', target_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL USING (app_is_platform_admin() OR EXISTS (SELECT 1 FROM scheduling_events WHERE scheduling_events.id = %I.%I)) WITH CHECK (app_is_platform_admin() OR EXISTS (SELECT 1 FROM scheduling_events WHERE scheduling_events.id = %I.%I))',
      target_table || '_parent_isolation',
      target_table,
      target_table,
      event_column,
      target_table,
      event_column
    );
  END LOOP;
END
$$;

UPDATE "plans"
SET "capabilities" = ARRAY(
  SELECT DISTINCT capability
  FROM unnest(
    "capabilities" || ARRAY[
      'scheduling.read',
      'scheduling.manage',
      'scheduling.intelligence'
    ]::varchar[]
  ) AS capability
)
WHERE "is_active" = true;
