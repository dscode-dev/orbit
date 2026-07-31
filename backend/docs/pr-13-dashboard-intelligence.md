# PR-13 — Dashboard & Intelligence

## Resolution flow

`GET /dashboard` receives the authenticated identity and an optional range/tag
filter. The flow is:

1. `DashboardRepository.context` opens an RLS transaction and reads the
   organization, segment, active plan, plan capabilities and module tags.
2. Module tags are resolved to active module keys.
3. `WidgetRegistry` supplies immutable widget definitions.
4. `WidgetResolver` normalizes the segment and filters definitions by segment,
   plan, enabled modules, user permissions and requested tags.
5. Definitions are ordered by `order` and `id`.
6. `WidgetFactory` asks the repository for the matching Read Model.
7. `DashboardService` returns one layout contract containing metadata and data.

The Dashboard owns no Customer, Operation, Report, inventory, weather or AI
business rule. It only resolves widgets and composes query-oriented Read Models.

`GET /dashboard/widgets/:id` uses exactly the same resolver and is available for
future lazy widget refreshes. It cannot bypass plan, module, segment or
permission checks.

## Registering a widget

Create a `DashboardWidgetDefinition` and register it in `WidgetRegistry`:

```ts
registry.register({
  id: 'new-segment-metric',
  title: 'New Metric',
  description: 'Query-oriented metric.',
  category: 'OPERATIONS',
  order: 400,
  size: 'MEDIUM',
  tags: ['new-segment', 'operations'],
  supportedSegments: ['NEW_SEGMENT'],
  requiredModules: ['operations'],
  requiredPlans: [],
  requiredPermissions: ['operations.read'],
  readModel: 'segment-metric',
});
```

If it needs a new data shape, add a typed Read Model and its repository/provider
implementation, then map its `readModel` key in `WidgetFactory` or the future
provider registry. No change is required in `DashboardController`,
`DashboardService`, layout resolution or frontend-specific logic.

The registry exposes `register`, so future feature modules can contribute
definitions during composition instead of adding conditional branches to the
Dashboard.

## Adding a segment

Add its normalized alias to the segment catalog and register widgets whose
`supportedSegments` contains that identifier. Shared widgets can list multiple
segments, as Weather & Environmental Intelligence does for `HVAC_R` and
`AGRO`.

The resolver is data-driven. New segments do not require changes to the
Dashboard controller, service, repository, response layout or permission
pipeline.

## Widget catalog

Global:

- Attention Center
- Executive KPIs
- Health Score
- Operational Trend
- Team Performance
- Recent Activity
- Upcoming Events
- Orbit Intelligence

HVAC-R:

- PMOC Status
- Equipment Health
- SLA
- Technicians
- Contracts
- Weather & Environmental Intelligence

Farmácia:

- Critical Stock
- Expiring Products
- Lots
- Purchases
- Dispensations
- ABC Curve

Agro:

- Fields Overview
- Crop Status
- Machinery
- Inputs
- Irrigation
- Production Forecast
- Weather & Environmental Intelligence

Weather & Environmental Intelligence is a shared widget definition rather than
two copies.

## Read Models

- `AttentionCenterReadModel`
- `ExecutiveKpiReadModel`
- `HealthScoreReadModel`
- `TrendReadModel`
- `TeamPerformanceReadModel`
- `RecentActivityReadModel`
- `UpcomingEventsReadModel`
- `OrbitIntelligenceReadModel`
- `WeatherEnvironmentalIntelligenceReadModel`
- `EnvironmentalIndex`
- `SegmentMetricReadModel`

`WeatherEnvironmentalIntelligenceReadModel` includes current conditions,
forecast, weather alerts, temperature, precipitation, wind, humidity, UV, air
quality, frost risk and heat stress-compatible indices, metric trends and an
intelligence summary with operational impacts, risks, opportunities and
practical recommendations.

`OrbitIntelligenceReadModel` supports recommendations, priorities, risks,
trends, confidence and AI insights. The current provider is deterministic mock
data; replacing it with PR-12 query results does not change the Dashboard
contract.

## Mocks and future data sources

Mocks live behind `DashboardRepository.read`, already returning the final typed
contracts. Future repositories can replace each mock independently with
database projections, materialized views, caches, PR-12 executions or external
environmental integrations. No external API is called in PR-13.

## Security

The context query uses `RlsTransaction`. The controller requires an active plan,
the `dashboard.read` capability and the `dashboard.read` permission. Individual
widgets may require additional module keys, plans and permissions. Unavailable
widgets are omitted; direct widget access returns forbidden.

The migration only adds `dashboard.read` to active plan capabilities and is
generated for manual application.
