# PR-03 Organization

The implementation uses the pre-existing `src/modules/organizations` and
`src/modules/subscription-plans` folders. No parallel module hierarchy was
created.

## Organization and business units

- `POST /organizations`
- `GET|PATCH /organizations/current`
- `GET|POST /organizations/current/business-units`
- `PATCH|DELETE /organizations/current/business-units/:id`

Organization creation is atomic and creates:

1. the organization and 14-day trial;
2. its primary business unit;
3. the tenant `OWNER` role;
4. organization and business-unit memberships for the creator.

Primary units cannot be deleted or directly demoted. Promoting another unit
demotes the previous primary in the same transaction. Parent units must belong
to the same organization and be accessible to the acting user.

## Plans, subscriptions, and usage

- `GET /plans`
- `POST /plans` and `PATCH /plans/:id` for platform administrators
- `GET|PATCH /organizations/current/subscription`
- `GET|POST /organizations/current/usage`

Plan limits use a JSON object:

```json
{
  "users": 25,
  "business_units": 5,
  "storage_gb": null
}
```

A non-negative number is a hard limit. `null` means unlimited. Missing
resources are not part of the plan.

Usage supports `RESERVE`, `RELEASE`, and `CONSUME`. Updates execute in
serializable transactions with contention retries. Consuming reserved capacity
converts the reservation into used capacity.

## Plan and capability enforcement

Nest guards provide reusable route middleware:

- `@RequiresActivePlan()`
- `@RequiresPlan('PRO', 'ENTERPRISE')`
- `@Capabilities('reports.create')`

They run after JWT authentication and use the organization carried by the
validated session. Application permissions and plan capabilities are separate:
both checks must pass when both decorators are present.

## Database migration

`20260730190000_pr03_organization_constraints` adds:

- one active primary unit per organization;
- valid subscription periods;
- non-negative usage and valid usage periods.

The migration was created but not applied.
