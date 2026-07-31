# PR-14 — Scheduling Engine

## Architecture

Scheduling is an independent engine, not a calendar owned by Operations.

- `SchedulingCalendar` groups events at organization or business-unit scope.
- `SchedulingEvent` contains the time window, display data and polymorphic
  source identity.
- `SchedulingRecurrence` stores recurrence rules without materializing an
  infinite number of rows.
- `SchedulingResourceAllocation` assigns users, assets or custom resources.
- `SchedulingAvailability` represents weekly/date-specific availability and
  blocking rules.
- `SchedulingEventHistory` is the event timeline.

All database access goes through `SchedulingRepository` and `RlsTransaction`.
The service owns validation, recurrence expansion, overlap analysis and Read
Model composition.

## Module-independent publication

Every event includes:

- `sourceModule`
- `sourceEntityType`
- `sourceEntityId`

Operations, PMOC, Purchases, Production, Audits or future modules do not need a
foreign key in Scheduling. They publish a command through the
`SCHEDULING_EVENT_PUBLISHER` port:

```ts
constructor(
  @Inject(SCHEDULING_EVENT_PUBLISHER)
  private readonly scheduling: SchedulingEventPublisher,
) {}

await this.scheduling.publish({
  organizationId,
  actorId,
  event: {
    calendarId,
    title: 'Auditoria programada',
    type: 'AUDIT',
    startsAt,
    endsAt,
    timezone: 'America/Recife',
    sourceModule: 'audits',
    sourceEntityType: 'AUDIT',
    sourceEntityId: auditId,
  },
});
```

The publishing module depends on a port and command contract, not on repository
models. Scheduling does not import the publishing module.

## Recurrence

Supported frequencies:

- `DAILY`
- `WEEKLY`, optionally restricted by weekdays `0..6`
- `MONTHLY`, optionally using a day of month
- `CUSTOM`, using explicit ISO timestamps

Rules support interval, occurrence count, end date, timezone and exception
timestamps. Occurrences are expanded only inside the requested window, with a
hard range limit of 366 days and a maximum of 2,000 occurrences per event.
Months without the requested day are skipped.

The current expansion preserves UTC duration and stores the intended IANA
timezone. A future timezone adapter can replace date arithmetic without
changing persistence or API contracts.

## Availability and conflicts

Resources:

- `USER`, identified by `userId`
- `ASSET`, identified by `assetId` in allocations and by its UUID as
  `resourceKey` in availability
- `CUSTOM`, identified by `resourceKey`

Availability can be weekly (`dayOfWeek`) or date-specific (`date`) and is
either `AVAILABLE` or `BLOCKED`. Rules use minutes since midnight and may have
effective date bounds.

The conflict engine detects:

- overlapping events on one calendar;
- overlapping allocation of the same resource;
- events intersecting blocked availability;
- events outside an explicitly configured availability window.

Critical resource and blocking conflicts reject writes unless
`allowConflicts=true`. Calendar-only and outside-availability conflicts remain
visible as warnings.

## Agenda and Read Models

`GET /scheduling/agenda` supports:

- `view=DAY`
- `view=WEEK`
- `view=MONTH`

It returns an `AgendaReadModel` grouped by day with totals, statuses, blocked
slots and allocated hours.

Read Models:

- `SchedulingOccurrenceReadModel`
- `AgendaReadModel`
- `SchedulingTimelineReadModel`
- `SchedulingConflictReadModel`
- `SchedulingIntelligenceReadModel`
- `DashboardSchedulingReadModel`

`GET /scheduling/dashboard` is the read contract intended for PR-13. The
Dashboard can consume it without knowing Scheduling entities or recurrence.

## Scheduling Intelligence

`GET /scheduling/intelligence` combines detected scheduling conflicts with
mocked contracts for:

- route optimization;
- delay probability and expected minutes;
- rescheduling recommendations;
- weather impact for HVAC-R and Agro.

The response identifies `source: MOCK`. No external routing, traffic, weather
or AI API is used in PR-14. Future providers can replace each mocked projection
without changing the endpoint contract.

## Filters

Organization is always taken from the authenticated tenant context and cannot
be overridden by query input. The range and agenda endpoints additionally
filter by:

- business unit;
- user allocation;
- customer;
- asset;
- segment;
- calendar and status where applicable.

## Endpoints

- `GET/POST /scheduling/calendars`
- `GET/PATCH/DELETE /scheduling/calendars/:id`
- `GET/POST /scheduling/events`
- `GET/PATCH/DELETE /scheduling/events/:id`
- `GET /scheduling/events/:id/timeline`
- `POST/DELETE /scheduling/events/:id/allocations`
- `GET/POST/DELETE /scheduling/availability`
- `GET /scheduling/agenda`
- `GET /scheduling/conflicts`
- `GET /scheduling/intelligence`
- `GET /scheduling/dashboard`

Capabilities:

- `scheduling.read`
- `scheduling.manage`
- `scheduling.intelligence`

The migration creates tables, constraints, partial indexes, RLS policies and
plan capabilities. It is generated for manual application and is not executed
automatically.
