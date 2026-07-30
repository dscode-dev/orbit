-- PR-05 / PR-06 — active-record uniqueness and domain constraints.
-- This migration is intentionally not executed by Codex.

DROP INDEX IF EXISTS "assets_organization_id_identifier_key";

CREATE UNIQUE INDEX IF NOT EXISTS "assets_identifier_unique_active"
  ON "assets" ("organization_id", "identifier")
  WHERE "deleted_at" IS NULL AND "identifier" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "assets_serial_unique_active"
  ON "assets" ("organization_id", "serial_number")
  WHERE "deleted_at" IS NULL AND "serial_number" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "customers_document_unique_active"
  ON "customers" ("organization_id", "document_type", "document_number")
  WHERE "deleted_at" IS NULL AND "document_number" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_primary_customer_unique_active"
  ON "contacts" ("organization_id", "customer_id")
  WHERE "deleted_at" IS NULL
    AND "customer_id" IS NOT NULL
    AND "is_primary" = true;

ALTER TABLE "assets"
  ADD CONSTRAINT "assets_identifier_pair_check"
  CHECK (
    ("identifier_type" IS NULL AND "identifier" IS NULL)
    OR
    ("identifier_type" IS NOT NULL AND "identifier" IS NOT NULL)
  ),
  ADD CONSTRAINT "assets_identifier_type_check"
  CHECK (
    "identifier_type" IS NULL
    OR "identifier_type" IN (
      'SERIAL_NUMBER',
      'QR_CODE',
      'NFC',
      'INTERNAL_CODE',
      'BARCODE',
      'RFID',
      'CUSTOM'
    )
  ),
  ADD CONSTRAINT "assets_warranty_date_check"
  CHECK (
    "installation_at" IS NULL
    OR "warranty_until" IS NULL
    OR "warranty_until" >= "installation_at"
  );

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_document_pair_check"
  CHECK (
    ("document_type" IS NULL AND "document_number" IS NULL)
    OR
    ("document_type" IS NOT NULL AND "document_number" IS NOT NULL)
  );

UPDATE "plans"
SET "capabilities" = ARRAY(
  SELECT DISTINCT capability
  FROM unnest(
    "capabilities" || ARRAY[
      'assets.read',
      'assets.manage',
      'crm.read',
      'crm.manage'
    ]::varchar[]
  ) AS capability
)
WHERE "is_active" = true;
