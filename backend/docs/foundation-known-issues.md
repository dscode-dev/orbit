# Foundation known issues

## Prisma schema validation

`npx prisma validate` and `npx prisma generate` currently fail because
`BusinessUnitMembership.organization` has no opposite relation field on
`Organization`. The Foundation PR intentionally does not change the pre-existing
schema, migrations, or RLS policy.

Until that schema issue is resolved, `PrismaModule` must be composed by the
application with a generated `PrismaClientContract` provider under the
`PRISMA_CLIENT` token. The repository and RLS abstractions are independent of
generated model types, so business repositories can adopt them after generation.

## RLS specification drift

`docs_and_specs/rls-and-constraints.sql` references tables that are not present in
the current Prisma schema and expects `app.business_unit_ids` and
`app.is_platform_admin`, while the Foundation brief also requests singular
`app.business_unit_id`, roles, and permissions. `RlsTransaction` sets all seven
request-local values for forward compatibility, without changing policy SQL.
