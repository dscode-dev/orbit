# Row Level Security policy

The canonical executable definition is
`prisma/migrations/20260730170000_enable_rls/migration.sql`. It is intentionally
separate from the baseline schema migration.

## Context contract

Every tenant database operation must execute inside a transaction populated by
`RlsTransaction`:

- `app.user_id`
- `app.organization_id`
- `app.business_unit_id`
- `app.business_unit_ids`
- `app.roles`
- `app.permissions`
- `app.is_platform_admin`

Values are transaction-local and therefore return automatically to an empty
state when a pooled connection is reused.

## Policy groups

- Global catalogs: `modules` and `plans`.
- Authentication bootstrap: `users`, `credentials`, `mfa_factors`,
  `password_reset_tokens`, `sessions`, and `identity_invitations`.
- Organization root: `organizations`.
- Organization scoped: usage, integrations, customers, categories, templates,
  documents, signatures, and AI records.
- Required business-unit scope: assets, operations, checklist executions, and
  reports.
- Optional business-unit scope: contacts, products, and notifications. A null
  unit means organization-wide.
- Parent inherited: operation users and history inherit the policy of their
  operation.
- Audit logs: tenant/unit scoped, SELECT and INSERT only.

Membership SELECT policies have a narrow bootstrap exception:
`user_id = app.user_id`. This lets authentication discover only the current
user's memberships before selecting an organization. Membership writes remain
strictly tenant/unit scoped.

System roles (`organization_id IS NULL`) are readable by authenticated users but
mutable only by platform administrators. Tenant roles remain isolated by
organization.

## Identity bootstrap exception

Authentication and token-consumption tables cannot use forced tenant RLS because
login, refresh, password reset, and invitation acceptance begin before a trusted
tenant context exists. Their repositories use exact identifiers or token
hashes, generic recovery responses, expiration checks, one-time consumption,
and application authorization.

## Applying

The migration has not been applied by Codex. After confirming the target
database:

```bash
npx prisma migrate deploy
```

Use an application database role without `BYPASSRLS`. Superusers and roles with
`BYPASSRLS` defeat tenant isolation even when policies are forced.
