# Execution Center

O centro operacional das execuções de artefato.

|            |                            |
| ---------- | -------------------------- |
| Rota       | `/execucoes`               |
| Capability | `artifact_executions.read` |
| Permissão  | `artifact_executions.read` |

---

## 1. Composição

```
KPIs — contagens do servidor, uma consulta por fila
  │
  ├── Visão geral ...... filas destacadas + Orbit Intelligence
  ├── Filas ............ listagem completa, filtro por status no servidor
  └── Revisões ......... aguardando revisão e pausadas, lado a lado
```

**Este centro não altera execução.** Mudar status, responder campo, anexar e
assinar continuam no Workspace da execução, onde o contexto existe. Aqui se
acompanha, encontra e navega.

## 2. KPIs — de onde vêm os números

### O Analytics não cobre execuções

Verificado contra a API:

```
GET /analytics/kpis → domínios publicados:
  CONTRACTS · EQUIPMENT · OPERATIONS · PMOC · TECHNICIANS
```

`AnalyticsDomain` não tem domínio de execução de artefato, e nenhum indicador
fala sobre elas. Consumir "exclusivamente Analytics" para estes KPIs devolveria
uma tela vazia.

### O que existe: contagem do servidor

`GET /artifact-executions?status=…&limit=1` devolve `meta.total` — contagem
feita **no banco, pelo backend**, uma por fila. É o mesmo caminho que o Asset
Workspace e o contador de notificações já usam.

`limit: 1` porque só o total interessa; a página em si é carregada pela fila
que o usuário abrir.

**Nada é somado no cliente.** A apresentação — rótulo, ícone, cor, formato, se
subir é bom — vem do **Metric Registry**, onde as métricas foram registradas:

| Métrica                   | Fila           |
| ------------------------- | -------------- |
| `executions.total`        | todas          |
| `executions.in_progress`  | `IN_PROGRESS`  |
| `executions.paused`       | `PAUSED`       |
| `executions.under_review` | `UNDER_REVIEW` |
| `executions.completed`    | `COMPLETED`    |

### Progresso global não existe

Cada execução publica o seu `progress` (e `progressDetails` no detalhe). **Não
há agregado**, e média calculada aqui seria indicador inventado. O painel
declara a ausência; o progresso por execução aparece na listagem, como já
aparecia.

## 3. Filas

Sete filas, uma por status publicado. Cada uma é **uma consulta ao backend**
com `status=…`, não um recorte da página carregada — é o único agrupamento que
`ArtifactExecutionQueryDto` suporta.

```
DRAFT · IN_PROGRESS · PAUSED · UNDER_REVIEW · APPROVED · COMPLETED · ARCHIVED
```

### Execução cancelada não existe

O pedido incluía uma fila de canceladas. O contrato não a tem. Verificado:

```
GET /artifact-executions?status=CANCELLED
→ 400  status must be one of the following values:
       DRAFT, IN_PROGRESS, PAUSED, UNDER_REVIEW, APPROVED, COMPLETED, ARCHIVED
```

`ARCHIVED` significa arquivada, que é outra coisa — tem fila própria. Uma fila
de canceladas seria uma categoria que nenhum outro cliente reconhece; a
ausência está declarada na tela.

## 4. Revisões

Reúne o que está parado esperando uma decisão: **aguardando revisão** e
**pausadas**, cada uma como listagem filtrada no servidor.

### Preparada para o Workflow Engine, sem implementá-lo

Não existe motor de workflow: não há etapas, aprovadores, prazos de revisão nem
transições configuráveis no contrato. O que existe é
`PATCH /artifact-executions/:id/status`, validado pelo backend.

O que esta PR deixa pronto é a **fronteira**: a área é composta a partir de
`REVIEW_QUEUES`. Quando o motor existir e publicar etapas, a lista de filas
passa a vir dele e nenhum componente desta pasta muda.

Nada de aprovação, delegação ou SLA é simulado.

## 5. Orbit Intelligence

Consome `GET /analytics/intelligence` — o contexto de inteligência **da
organização**, o mesmo que alimenta o Dashboard. É o único endpoint que publica
prioridades, riscos e tendências em escopo de tenant.

As `insights` por execução (`kind`, `severity`, `source`, `title`,
`description`) existem **dentro** do detalhe de cada execução, e não há rota
que as liste em conjunto. Montá-las aqui exigiria abrir uma execução por vez e
agregar no cliente. Elas continuam onde o contrato as coloca: no Workspace.

Nada é gerado localmente.

## 6. Tempo real

**Não há canal para execuções.** O gateway Socket.IO do backend é de
notificações; não existe evento de execução, nem endpoint de stream.

A cadência é a mesma da listagem — `refetchInterval` — e a arquitetura fica
pronta: as contagens e as filas passam por hooks isolados
(`use-execution-center.ts`), então trocar a fonte por um canal não muda nenhum
componente.

**Nada simula WebSocket.**

## 7. Navegação

Cliente, equipamento, operação e artefato são alcançados pelo **Entity
Registry** — nenhuma rota é montada à mão. A listagem publica os
identificadores (`operationId`, `customerId`, `assetId`); resolver nomes de
todos viraria N+1 por página, então os nomes aparecem no Workspace, onde é uma
leitura por vínculo.

## 8. Endpoints utilizados

| Endpoint                                | Uso                                  |
| --------------------------------------- | ------------------------------------ |
| `GET /artifact-executions`              | filas, busca, paginação e contagens  |
| `GET /artifact-executions/:id`          | Workspace da execução (já existente) |
| `GET /artifact-executions/:id/progress` | painel de progresso (já existente)   |
| `GET /analytics/intelligence`           | Orbit Intelligence da organização    |

## 9. Limitações do backend

| Limitação                                                 | Consequência                        |
| --------------------------------------------------------- | ----------------------------------- |
| Analytics sem domínio de execução                         | KPIs vêm de contagens por fila      |
| Sem progresso agregado                                    | nenhum "progresso global" é exibido |
| Sem status `CANCELLED`                                    | não há fila de canceladas           |
| Sem rota que liste insights de várias execuções           | inconsistências ficam no Workspace  |
| Sem canal de tempo real para execuções                    | polling, declarado na tela          |
| `ArtifactExecutionQueryDto` sem ordenação e sem `groupBy` | ordem e agrupamento são do servidor |
| Sem filtro por `templateId` ou `artifactType`             | não há fila por tipo de artefato    |

## 10. O que **não** foi implementado

- nenhum cálculo de métrica no cliente;
- nenhuma simulação de tempo real;
- nenhum Workflow Engine;
- nenhuma IA gerada localmente;
- nenhum componente novo no Design System;
- nenhuma alteração de execução fora do Workspace.
