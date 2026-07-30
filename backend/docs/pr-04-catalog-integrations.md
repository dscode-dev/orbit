# PR-04 Product Catalog and Integrations

The implementation uses the existing `technical-catalogs` and `integrations`
module folders.

## Product catalog

- `GET|POST /catalog/categories`
- `PATCH|DELETE /catalog/categories/:id`
- `GET|POST /catalog/products`
- `GET|PATCH|DELETE /catalog/products/:id`

Products may be organization-wide (`businessUnitId = null`) or scoped to one
business unit. `CatalogService.findAvailableForBusinessUnit` is exported for
Operations, Reports, and CRM consumers and returns active organization-wide or
matching-unit products only.

Category parents are tenant validated, cycles are rejected, and categories with
active children or products cannot be deleted. Products and categories use soft
delete.

## Integrations

- `GET|POST /integrations`
- `GET|PATCH|DELETE /integrations/:id`
- `POST /integrations/:id/validate`

Provider secrets:

- are accepted only on create/update;
- are encrypted using the Foundation crypto provider;
- are stored in `encrypted_secrets`;
- are never selected by public repository methods or returned by controllers.

External validation uses `IntegrationAdapter` and
`IntegrationProviderRegistry`. No provider-specific network implementation is
invented by this PR; adapters can be registered by future provider modules.

## Access control

Routes require an active subscription plus the corresponding application
permission and plan capability:

- `catalog.read`
- `catalog.manage`
- `integrations.read`
- `integrations.manage`

Existing RLS policies already cover organization-scoped categories and
integrations and optional-unit-scoped products.

## Migration

`20260730210000_pr04_catalog_integrations_constraints` replaces regular unique
indexes with soft-delete-aware partial indexes and enforces non-negative product
prices. It was created but not applied.
