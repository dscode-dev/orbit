# PR-12 — AI Agents and Executions

## Architecture

The AI module is an orchestrator. Domain services do not import a vendor SDK.
`AiProviderAdapter` defines the provider boundary and the first adapter supports
OpenAI-compatible `/chat/completions` APIs through the native HTTP client.

Provider credentials are never stored in agents or executions. An agent points
to an active tenant `OPENAI_COMPATIBLE` Integration in category `AI`; its encrypted `apiKey` is decrypted only
during execution and is never returned or persisted in snapshots.

Integration configuration:

```json
{
  "baseUrl": "https://provider.example/v1"
}
```

Integration secrets:

```json
{
  "apiKey": "secret"
}
```

## Agent versioning

Agent metadata can be updated in place. Changing provider, model, integration,
system prompt, tools, key, or runtime configuration creates a new version under
`organizationId + key`. Existing executions retain a complete agent snapshot.

Supported governed context tools:

- `customer.read`
- `operation.read`
- `report.read`

Passing a resource reference to an agent without the corresponding tool is
rejected. Context queries use the existing tenant and business-unit RLS.
Snapshots intentionally contain only selected domain fields.

## Executions

Execution lifecycle:

`PENDING -> RUNNING -> SUCCEEDED | FAILED`

Only a pending execution can be cancelled. Execution requests support an
idempotency key scoped by organization and requesting user. Reusing the same
key with different input is rejected.

Each execution records:

- input and SHA-256 input hash;
- immutable agent and context snapshots;
- output and SHA-256 output hash;
- provider request identifier;
- model, token usage, estimated cost, duration, timestamps and structured error;
- optional Customer, Operation and Report references.

When requested, completion or failure creates a durable in-app notification and
a realtime event for the requesting user.

## Routes

- `GET/POST /ai-agents`
- `GET/PATCH/DELETE /ai-agents/:id`
- `POST /ai-agents/:id/executions`
- `GET /ai-executions`
- `GET /ai-executions/:id`
- `POST /ai-executions/:id/cancel`

Capabilities:

- `ai.agents.read`
- `ai.agents.manage`
- `ai.executions.read`
- `ai.executions.run`

The PR-12 migration adds the relational constraints, partial idempotency index,
hash/snapshot backfill, validation constraints and notification RLS extension.
It is generated for manual application and is not automatically executed.
