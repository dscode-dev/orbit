# Foundation known issues

## Prisma schema validation

Resolved in PR-02 by adding the missing
`Organization.businessUnitMemberships` relation. Prisma validation and client
generation now pass.

## RLS specification drift

Resolved by the schema-aligned
`20260730170000_enable_rls` migration. The historical
`docs_and_specs/rls-and-constraints.sql` draft is explicitly marked as legacy
and must not be applied.
