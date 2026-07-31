-- PR-13 — Dashboard capability.
-- This migration is intentionally not executed by Codex.

UPDATE "plans"
SET "capabilities" = ARRAY(
  SELECT DISTINCT capability
  FROM unnest(
    "capabilities" || ARRAY['dashboard.read']::varchar[]
  ) AS capability
)
WHERE "is_active" = true;
