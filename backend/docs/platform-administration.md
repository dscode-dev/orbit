# Platform Administration and Tenant Provisioning

## Two onboarding paths

Orbit now supports two explicit tenant creation paths:

1. `POST /identity/register` is the self-service path used after plan
   selection/subscription. It creates the user, organization, primary business
   unit, tenant `OWNER` role and both memberships atomically, then authenticates
   the new owner.
2. `POST /platform-admin/tenants` is the operator path. It uses the same
   provisioning transaction, but allows a global administrator to define the
   initial organization/subscription status, period end and external billing
   identifiers. It does not log in as the created owner and records a global
   audit event.

The shared `RegistrationRepository` is the provisioning boundary, preventing
the two flows from drifting or creating different owner semantics.

## Global administrator model

`PlatformRoleAssignment` associates users with global roles whose
`organizationId` is null. This is intentionally separate from
`OrganizationMembership`: a platform administrator is not an owner or member
of every customer tenant.

During authentication, active global assignments are included in JWT roles and
permissions. `PLATFORM_ADMIN` activates the existing
`app.is_platform_admin` RLS context. Platform endpoints additionally require:

- role `PLATFORM_ADMIN`;
- permission `platform.admin`.

The seeded system role grants `*` and `platform.admin`. Tenant routes that
require an organization context remain tenant routes; cross-tenant operations
are exposed through the audited platform administration API rather than by
impersonating a tenant.

## Administration API

- `GET /platform-admin/overview`: global tenant/user/subscription/resource totals.
- `GET /platform-admin/organizations`: paginated cross-tenant organization list.
- `GET /platform-admin/organizations/:id`: organization, owner, plan, units and totals.
- `PATCH /platform-admin/organizations/:id`: plan, lifecycle and subscription management.
- `POST /platform-admin/tenants`: atomic tenant plus first-owner provisioning.
- `GET /platform-admin/users`: paginated cross-tenant user list.
- `GET /platform-admin/resources`: plans and modules.

The existing `POST /plans` and `PATCH /plans/:id` routes already require
`PLATFORM_ADMIN`; the new global assignment makes those resource-management
routes usable without attaching the administrator to a customer tenant.

Organization creation and administration changes write `AuditLog` records.
No password or credential hash is returned by any endpoint.

## First platform administrator seed

Apply the generated migration manually first, then configure these values in
`backend/.env` or the repository root `.env`:

```dotenv
PLATFORM_ADMIN_EMAIL=admin@example.com
PLATFORM_ADMIN_PASSWORD=a-strong-password-with-12-or-more-characters
PLATFORM_ADMIN_FIRST_NAME=Orbit
PLATFORM_ADMIN_LAST_NAME=Administrator
```

Run from `backend`:

```bash
npm run seed:platform-admin
```

The seed is idempotent. It creates or updates the global system role, user,
credential and active role assignment. Running it again deliberately resets
that administrator's password to `PLATFORM_ADMIN_PASSWORD`, unlocks the
credential, restores a revoked assignment and revokes earlier sessions. It
does not create a customer organization for the administrator.

For elevated sessions, the JWT guard revalidates the active
`PLATFORM_ADMIN` assignment on every authenticated request. Revoking the
assignment therefore also revokes effective platform access without waiting
for access-token expiration.

## Migration and RLS

The migration creates `platform_role_assignments`, foreign keys, indexes, a
partial unique index for global role keys and forced RLS. Users can read their
own active assignment during login bootstrap; only an already-authorized
platform administrator can mutate assignments through application RLS.

The migration was generated for manual application and is not executed by the
application or seed.
