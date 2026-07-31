-- PR-15 — Analytics Engine capability.
-- Analytics owns no tables: all source reads remain protected by the existing
-- tenant RLS policies and are executed through RlsTransaction.
-- This migration is intentionally not executed by Codex.

UPDATE "plans"
SET "capabilities" = ARRAY(
  SELECT DISTINCT capability
  FROM unnest(
    "capabilities" || ARRAY['analytics.read']::varchar[]
  ) AS capability
)
WHERE "is_active" = true;

