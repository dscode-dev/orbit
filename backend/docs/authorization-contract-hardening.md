# PR-26.9 — Authorization & Contract Hardening

## Analytics authorization matrix

| Surface                                              | Data domains                                              | Effective capabilities                                  |
| ---------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| `/analytics/kpis`                                    | Operations, PMOC, Equipment, Technicians, Contracts proxy | `analytics.read` plus each available domain capability  |
| `/analytics/trends`                                  | Operations, PMOC                                          | `analytics.read` + `operations.read` and/or `pmoc.read` |
| `/analytics/health`                                  | Operations, PMOC, Equipment, Contracts proxy, Environment | `analytics.read` plus each available domain capability  |
| `/analytics/forecasts`                               | Operations, PMOC                                          | `analytics.read` + `operations.read` and/or `pmoc.read` |
| `/analytics/overview`, `/dashboard`, `/intelligence` | Composite of the rows above                               | partial sections, never an implicit aggregate grant     |
| `/analytics/environmental-impact`                    | mocked environmental model                                | `analytics.read`                                        |

The centralized mapping is `ANALYTICS_DOMAIN_CAPABILITIES`:

- `OPERATIONS` → `operations.read`;
- `PMOC` → `pmoc.read`;
- `EQUIPMENT` → `assets.read`;
- `TECHNICIANS` → `operations.read` + `workforce.read`;
- `CONTRACTS` → `customers.read` because this remains the documented customer proxy;
- `ENVIRONMENT` → no additional domain capability while its source remains mock-derived.

Composite endpoints publish `availability` for every domain. A blocked domain is
not queried, its metrics are omitted, and `blockedReason` is
`MISSING_DOMAIN_CAPABILITY`; absence is never represented as a numeric zero.
Provenance (`OBSERVED`, `DERIVED`, `PROXY`, `MOCK`) is unchanged.

## Dashboard PMOC

`hvac-pmoc-status` requires `pmoc.read`, not `reports.read`. There is no separate
PMOC module row in the current plan catalog, so `requiredModules` is empty and
the authoritative plan capability/actor permission controls access. Its data is
aggregated directly from `pmoc_plans` and `pmoc_executions` under RLS; the
generic segment mock is no longer used for this widget.

## Operation transitions

Only `OperationDetailsReadModel` publishes `transitions`; list items stay compact.
Both mutation validation and the mapper call `OperationStateMachine`, so there
is one transition authority. The consistency test iterates every pair of current
statuses: published transitions must resolve through the real service action,
and every absent transition must be rejected.

## Synchronized contract boundary

`contracts-sync.manifest.json` is the shared source of the Read Models copied by
the web sync. The protected set is all TypeScript under `src/contracts/**` plus
every Read Model in that manifest. Imports and re-exports may target only another
file in this set. External packages (including `@prisma/client`) and backend
services, repositories, adapters, infrastructure, DTO implementations or domain
internals are rejected.

`contracts:guard` parses imports with the TypeScript Compiler API and reports the
source file, forbidden specifier and expected boundary. `contracts:sync` invokes
the guard before deleting or copying frontend files. Synthetic tests prove a
contract-to-contract import succeeds while Prisma and service imports fail.
