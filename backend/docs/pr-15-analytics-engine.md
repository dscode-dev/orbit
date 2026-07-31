# PR-15 — Analytics Engine

## Architecture

Analytics is a read-only transformation engine. It owns no tables and never
duplicates facts from Operations, Reports/PMOC, Assets, Users or Customers.
`AnalyticsRepository` collects one tenant-scoped snapshot inside
`RlsTransaction`; existing source-table RLS policies therefore remain the
security boundary.

`AnalyticsService` only orchestrates this pipeline:

1. normalize and validate a maximum 366-day query range;
2. load the cross-module snapshot under RLS;
3. read the shared Weather & Environmental Intelligence provider;
4. run `KpiEngine`, `TrendEngine` and `EnvironmentalImpactEngine`;
5. feed their outputs to `HealthEngine` and `ForecastEngine`;
6. compose endpoint-specific Read Models.

No external API, AI model or analytics persistence is used in PR-15.

## Specialized engines

- `KpiEngine`: operational volume/completion/SLA, PMOC compliance, equipment
  availability, technician assignment and contract proxy metrics.
- `TrendEngine`: day/week/month time buckets for created/completed operations
  and PMOCs.
- `HealthEngine`: weighted domain health with explicit drivers.
- `ForecastEngine`: linear regression when enough points exist, otherwise a
  moving average. It is intentionally replaceable by a future prediction
  provider.
- `EnvironmentalImpactEngine`: transforms the shared weather contract into
  cooling load, field-work risk, delay risk and equipment stress indices.

Contracts are marked with `dataQuality` (`OBSERVED`, `DERIVED`, `PROXY` or
`MOCK`) and `source`, so consumers never need to infer provenance. There is no
Contract entity yet; `contracts.active_proxy` uses active Customers and is
explicitly marked `PROXY`. A future Contracts repository can replace only that
projection without changing the KPI contract or engines.

## Read Models

- `KpiReadModel` / `AnalyticsKpi`
- `TrendReadModel` / `AnalyticsTrend`
- `AnalyticsHealthReadModel` / `HealthDimension`
- `ForecastReadModel` / `AnalyticsForecast`
- `EnvironmentalImpactReadModel`
- `AnalyticsOverviewReadModel`
- `AnalyticsDashboardReadModel`
- `OrbitIntelligenceAnalyticsContext`

Dashboard consumes the compact contract from `GET /analytics/dashboard`.
Orbit Intelligence can inject `ANALYTICS_READ_PORT` and call
`intelligenceContext`, avoiding a dependency on Analytics persistence or HTTP.

## Adding a KPI

1. Add only the required source projection to `AnalyticsSnapshot` and
   `AnalyticsRepository`.
2. Register the calculation in `KpiEngine` (or a future domain KPI provider).
3. Set stable `id`, domain, source and data quality.
4. Add an engine unit test.

Controllers, the service pipeline and consumers do not change. A future KPI
registry can split domain calculators behind the same `KpiEngine` contract.

## Adding a Read Model or prediction engine

Create a typed composer over existing engine outputs, then expose it from the
service or through `ANALYTICS_READ_PORT`. Do not query Prisma from the composer.
A future `PredictionEngine` can consume the same trends and snapshots, and a
machine-learning adapter can replace `ForecastEngine` through dependency
injection without changing Dashboard or Orbit Intelligence contracts.

## Endpoints and access

- `GET /analytics/overview`
- `GET /analytics/kpis`
- `GET /analytics/trends`
- `GET /analytics/health`
- `GET /analytics/forecasts`
- `GET /analytics/environmental-impact`
- `GET /analytics/dashboard`
- `GET /analytics/intelligence`

All routes require an active plan, `analytics.read` capability and
`analytics.read` permission. Organization always comes from the authenticated
identity; clients cannot override tenant scope. The capability-only migration
contains no tables because Analytics owns no data and was generated for manual
application only.
