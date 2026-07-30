# PR-07 Operations

## Escopo

O módulo implementa CRUD, filtros, atribuições, histórico, timeline, status e
anexos. Não cria nem consulta relatórios.

### Status

Fluxo permitido:

- `OPEN` → `SCHEDULED`, `IN_PROGRESS`, `CANCELLED`
- `SCHEDULED` → `OPEN`, `IN_PROGRESS`, `CANCELLED`
- `IN_PROGRESS` → `PAUSED`, `COMPLETED`, `CANCELLED`
- `PAUSED` → `IN_PROGRESS`, `CANCELLED`
- `CANCELLED` → `OPEN`
- `COMPLETED` é terminal

Mudanças usam compare-and-set no status atual para evitar atualizações
concorrentes silenciosas.

### Anexos

Uploads multipart usam o campo `file`, limite de 20 MiB e armazenamento privado.
O PostgreSQL mantém nome, MIME, tamanho, SHA-256 e chave interna. Downloads
exigem autenticação e passam pela policy RLS da operação.

Em produção, `OPERATION_UPLOAD_DIR` aponta para o volume
`operation_attachments`.

## Endpoints

- `GET /operations`
- `GET /operations/:id`
- `POST /operations`
- `PATCH /operations/:id`
- `DELETE /operations/:id`
- `PATCH /operations/:id/status`
- `POST /operations/:id/assignments`
- `DELETE /operations/:id/assignments/:userId`
- `GET /operations/:id/history`
- `GET /operations/:id/timeline`
- `POST /operations/:id/attachments`
- `GET /operations/:id/attachments/:attachmentId`
- `DELETE /operations/:id/attachments/:attachmentId`

## Docker

`docker-compose.yml` contém builds multi-stage para API e frontend, execução sem
root, healthchecks, redes separadas e volumes persistentes. Migrations não são
executadas no startup; devem ser aplicadas explicitamente pelo responsável pelo
ambiente antes do primeiro deploy.
