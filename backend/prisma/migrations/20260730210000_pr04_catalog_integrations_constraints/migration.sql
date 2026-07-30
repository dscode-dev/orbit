-- PR-04 soft-delete-aware uniqueness and monetary invariants.

DROP INDEX IF EXISTS product_categories_organization_id_slug_key;
CREATE UNIQUE INDEX product_categories_org_slug_active_key
  ON product_categories (organization_id, slug)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS products_organization_id_sku_key;
CREATE UNIQUE INDEX products_org_sku_active_key
  ON products (organization_id, sku)
  WHERE sku IS NOT NULL AND deleted_at IS NULL;

DROP INDEX IF EXISTS integrations_organization_id_provider_display_name_key;
CREATE UNIQUE INDEX integrations_org_provider_name_active_key
  ON integrations (organization_id, provider, display_name)
  WHERE deleted_at IS NULL;

ALTER TABLE products
  ADD CONSTRAINT products_non_negative_prices
  CHECK (
    (sale_price IS NULL OR sale_price >= 0)
    AND (cost_price IS NULL OR cost_price >= 0)
  );
