# Orbit Contracts Manifest

Referência arquitetural dos contratos compartilhados entre os clientes do
Orbit. Quem for alterar o backend consulta este documento para saber **quem
quebra**; quem for construir um cliente novo consulta para saber **o que
existe**.

| Papel        | Stack                              | Como fala com o backend            |
| ------------ | ---------------------------------- | ---------------------------------- |
| Backend      | NestJS + Prisma + PostgreSQL (RLS) | —                                  |
| Frontend Web | Next.js 16 (App Router)            | via BFF próprio (`/api/orbit/**`)  |
| Mobile       | Flutter 3.44 (Orbit Operator)      | direto no NestJS, com Bearer token |

Última revisão: PR Frontend-14.5 (Registry Kernel & Frontend Core Refinement).

---

## 1. Princípios

1. **O backend é a única autoridade.** Regra de negócio, autorização,
   transições de estado e cálculo de indicadores vivem lá. Cliente que replica
   regra cria uma segunda fonte de verdade que diverge no primeiro ajuste.
2. **Contrato é o que o backend publica**, não o que o cliente gostaria de ter.
   Onde falta suporte, o cliente declara a ausência — não improvisa.
3. **Envelope único.** Toda resposta segue o mesmo formato; todo cliente
   desembrulha no mesmo lugar.
4. **Procedência viaja com o dado.** Indicadores carregam `dataQuality`, e os
   clientes preservam essa semântica na interface.

---

## 2. Envelope

Sucesso (`ResponseInterceptor`):

```jsonc
{ "success": true, "data": {}, "requestId": "…", "timestamp": "…" }
```

Erro (`FoundationExceptionFilter`):

```jsonc
{
  "success": false,
  "error": { "code": "…", "message": "… | […]", "details": … },
  "requestId": "…",
  "timestamp": "…"
}
```

`message` pode ser string ou lista (validação do `ValidationPipe`). Os dois
clientes normalizam para uma única mensagem.

| Cliente | Onde desembrulha                                                     |
| ------- | -------------------------------------------------------------------- |
| Web     | `frontend/src/api/http.ts` e `frontend/src/server/backend-client.ts` |
| Mobile  | `mobile/lib/core/network/orbit_api_client.dart`                      |

---

## 3. Contexto de requisição

Cabeçalhos propagados em toda chamada:

| Cabeçalho            | Consumo no backend                                        | Web                   | Mobile             |
| -------------------- | --------------------------------------------------------- | --------------------- | ------------------ |
| `authorization`      | `JwtAuthenticationGuard` — identidade, escopo, permissões | ✓ (injetado pelo BFF) | ✓ (secure storage) |
| `x-request-id`       | `RequestIdInterceptor` — correlação ponta a ponta         | ✓                     | ✓                  |
| `accept-language`    | `RequestContextInterceptor` → `RequestContext.locale`     | ✓                     | ✓                  |
| `x-timezone`         | propagado; ainda não lido                                 | ✓                     | ✓                  |
| `x-organization-id`  | propagado; ainda não lido                                 | ✓                     | —                  |
| `x-business-unit-id` | propagado; ainda não lido                                 | ✓                     | —                  |
| `x-orbit-client`     | propagado; ainda não lido                                 | —                     | ✓ (`MOBILE`)       |

**O escopo efetivo vem das claims do JWT**, não desses cabeçalhos. Eles servem
para correlacionar logs e para o backend passar a validá-los sem mudança nos
clientes.

---

## 4. Origem dos DTOs

| Conjunto                                         | Origem                                          | Web                                                                             | Mobile                                                  |
| ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Tipos e literais base                            | `backend/src/contracts/**`                      | **sincronizado** por `npm run contracts:sync` → `frontend/src/types/contracts/` | **espelhado à mão** em `mobile/lib/core/contracts/`     |
| Read Models (dashboards, analytics, scheduling)  | `backend/src/modules/*/[modulo].read-models.ts` | **sincronizado** (mesmo script)                                                 | espelhado à mão (recorte usado)                         |
| Respostas de Operations, Identity, Organizations | Read Models públicos + mappers explícitos       | **sincronizado** por `contracts:sync`                                           | parser compatível em `mobile/lib/core/contracts/`       |
| Artifact Templates                               | Read Models públicos + mapper explícito         | **sincronizado** por `contracts:sync`                                           | parser tolerante em `artifact_template_contracts.dart`  |
| Artifact Executions                              | Read Models públicos + mapper explícito         | **sincronizado** por `contracts:sync`                                           | parser tolerante em `artifact_execution_contracts.dart` |
| CRM (clientes e contatos)                        | Read Model público + mapper explícito (PR-11)   | **sincronizado** por `contracts:sync`                                           | não consumido                                           |
| Artifact Manifest & Storage                      | Read Models públicos + mappers explícitos       | **sincronizado** por `contracts:sync`                                           | espelhado em `artifact_manifest_contracts.dart`         |
| Artifact Rendering                               | Read Models públicos                            | **sincronizado** por `contracts:sync`                                           | espelhado em `artifact_render_contracts.dart`           |
| Notifications                                    | registro do Prisma, sem Read Model              | **espelhado à mão** em `src/types/notifications.ts`                             | não consumido                                           |

### Consequência prática

Os módulos migrados não dependem mais da forma de retorno do Prisma:

- **Sincronizado** (contracts + read models): o backend é fonte única; o
  cliente regenera. Renomear um campo aqui quebra a compilação do web na hora,
  que é o comportamento desejado.
- **Sincronizado**: Identity, Organizations, Operations, Dashboard, Analytics
  e Scheduling têm Read Models cuja fonte única é o backend.
- **Mapeado**: controllers selecionam o contrato por mappers testáveis; campos
  adicionados ao Prisma não passam a existir na API por acidente.

**O CRM entrou nesse grupo na PR-11.** Até então o controller devolvia o
registro do Prisma, o que publicava `deletedAt` — marca de exclusão lógica — e
`_count`, nome gerado pelo ORM. `CustomerReadModel` e `CustomerReadModelMapper`
fecharam a fronteira; a regra de exclusão lógica **não mudou**, apenas deixou de
atravessar a API. O teste `customer.mapper.spec.ts` fixa isso.

**Notifications continua espelhado** — é o próximo candidato: `payload` sem
esquema e ausência de Read Model são as duas fragilidades registradas na §9.

---

## 5. Contratos públicos

Marcados com `@Public()` — acessíveis sem sessão.

| Endpoint                            | Uso                            | Web | Mobile |
| ----------------------------------- | ------------------------------ | --- | ------ |
| `POST /identity/login`              | autenticação                   | ✓   | ✓      |
| `POST /identity/register`           | onboarding público             | ✓   | —      |
| `POST /identity/refresh`            | rotação de tokens              | ✓   | ✓      |
| `POST /identity/password/forgot`    | recuperação                    | ✓   | —      |
| `POST /identity/password/reset`     | nova senha                     | ✓   | —      |
| `POST /identity/invitations/accept` | aceite de convite              | ✓   | —      |
| `GET /plans`                        | escolha de plano no onboarding | ✓   | —      |

No web esses passam pelo BFF com uma allowlist explícita
(`frontend/src/server/bff/allowlist.ts`), porque o proxy exige sessão por
padrão. As rotas que emitem token são **bloqueadas** no proxy genérico: iriam
expor o par de tokens ao JavaScript da página.

---

## 6. Contratos internos por cliente

### 6.1 Identidade e sessão

| Endpoint                                  | Web | Mobile |
| ----------------------------------------- | --- | ------ |
| `GET /identity/me`                        | ✓   | ✓      |
| `POST /identity/logout`                   | ✓   | ✓      |
| `GET /organizations/current`              | ✓   | ✓      |
| `GET /organizations/current/subscription` | ✓   | ✓      |
| `GET /identity/me/sessions`               | —   | —      |

`GET /organizations/current` exige assinatura ativa (`@RequiresActivePlan`):
responde 403 quando o plano vence. **Ambos os clientes toleram essa falha** e
mantêm a sessão, para mostrar o estado de assinatura bloqueada em vez de
expulsar o usuário.

### 6.2 Operations

| Endpoint                                  | Web     | Mobile              |
| ----------------------------------------- | ------- | ------------------- |
| `GET /operations`                         | ✓       | ✓                   |
| `GET /operations/:id`                     | ✓       | ✓                   |
| `GET /operations/:id/timeline`            | ✓       | ✓                   |
| `GET /operations/:id/history`             | ✓       | ✓                   |
| `PATCH /operations/:id/status`            | ✓       | ✓                   |
| `POST /operations/:id/attachments`        | ✓       | ✓ (fila resiliente) |
| `GET /operations/:id/attachments/:id`     | ✓       | —                   |
| `DELETE /operations/:id/attachments/:id`  | ✓       | —                   |
| `POST/DELETE /operations/:id/assignments` | parcial | —                   |
| `GET /checklist-executions?operationId=`  | ✓       | ✓                   |

### 6.3 Dashboard, Analytics e Scheduling

| Endpoint                                        | Web                          | Mobile |
| ----------------------------------------------- | ---------------------------- | ------ |
| `GET /dashboard`                                | ✓ (autoridade de **layout**) | —      |
| `GET /analytics/dashboard`                      | ✓                            | ✓      |
| `GET /analytics/{kpis,trends,health,forecasts}` | ✓                            | —      |
| `GET /analytics/environmental-impact`           | ✓                            | —      |
| `GET /analytics/intelligence`                   | ✓                            | —      |
| `GET /scheduling/agenda`                        | ✓                            | ✓      |
| `GET /ai-executions?operationId=`               | ✓                            | ✓      |
| `GET /notifications`                            | —                            | ✓      |

**Nota importante sobre `GET /dashboard`:** o campo `widget.data` é fixture no
backend (`DashboardRepository.read()` devolve dados escritos no código; só
`context()` consulta o banco). O web o usa como autoridade de _layout_ e busca
os números no Analytics. Qualquer cliente novo deve fazer o mesmo.

### 6.4 Artifact Templates

| Endpoint                                                       | Web                   | Mobile            |
| -------------------------------------------------------------- | --------------------- | ----------------- |
| `GET/POST /artifact-templates`                                 | contrato sincronizado | parser disponível |
| `GET/PATCH/DELETE /artifact-templates/:id`                     | contrato sincronizado | parser disponível |
| `GET/POST /artifact-templates/:id/versions`                    | contrato sincronizado | parser disponível |
| `GET /artifact-templates/:id/versions/:version`                | contrato sincronizado | parser disponível |
| `POST /artifact-templates/:id/{activate,deactivate,duplicate}` | contrato sincronizado | parser disponível |

O contrato público é definido por `artifact-template.read-models.ts`; JSON do
Prisma nunca é devolvido diretamente. Tipos de artefato, seção, campo e papel
de assinatura são chaves de metadados extensíveis, não enums de cliente.

Duas características moldam qualquer cliente que consuma este módulo:

- **`PATCH /:id` altera apenas metadados** — nome, descrição, tipo, segmento,
  visibilidade, etiquetas e ordenação. Não existe rota de edição de estrutura.
- **Estrutura muda por versão nova e imutável** (`POST /:id/versions`), com o
  número atribuído pelo backend sob `pg_advisory_xact_lock`.

É daí que sai o comportamento do Artifact Studio: salvamento automático só onde
a escrita é idempotente (propriedades), publicação explícita onde ela cria
versão (estrutura). Templates com `organizationId` nulo são da plataforma e
somente leitura para o tenant — editar exige duplicar.

### 6.5 Artifact Executions

| Endpoint                                    | Web                   | Mobile            |
| ------------------------------------------- | --------------------- | ----------------- |
| `GET/POST /artifact-executions`             | contrato sincronizado | parser disponível |
| `GET/PATCH /artifact-executions/:id`        | contrato sincronizado | parser disponível |
| `PATCH /artifact-executions/:id/status`     | contrato sincronizado | parser disponível |
| `PUT /artifact-executions/:id/responses`    | contrato sincronizado | parser disponível |
| `POST /artifact-executions/:id/attachments` | contrato sincronizado | parser disponível |
| `POST /artifact-executions/:id/signatures`  | contrato sincronizado | parser disponível |
| `GET /artifact-executions/:id/progress`     | contrato sincronizado | parser disponível |

`ArtifactExecutionReadModel` contém um `ArtifactSnapshotReadModel` imutável.
Clientes nunca reconstroem a execução consultando a versão ativa do template e
nunca calculam progresso ou autorizam transições localmente.

**`renderStatus`** (`NOT_RENDERED` · `PENDING` · `RENDERING` · `READY` ·
`FAILED`) é publicado desde já para que os clientes tratem o ciclo completo de
renderização sem mudança de contrato. Enquanto não existe motor de
renderização, o backend responde sempre `NOT_RENDERED` — é declaração de
ausência, não estado de espera.

Duas propriedades úteis a qualquer cliente:

- **Quase toda escrita devolve a execução inteira**, com `progressDetails`
  recalculado. Dá para semear o cache com o retorno da mutação em vez de
  reler.
- **Os erros têm código estável** (`INVALID_ARTIFACT_EXECUTION_TRANSITION`,
  `ARTIFACT_EXECUTION_INCOMPLETE`, `ARTIFACT_EXECUTION_NOT_EDITABLE`), o que
  permite reagir a uma regra sem reproduzi-la.

---

## 7. Procedência dos indicadores

`AnalyticsKpi.dataQuality` classifica cada número:

| Valor      | Significado                               | Tratamento nos clientes |
| ---------- | ----------------------------------------- | ----------------------- |
| `OBSERVED` | contagem direta dos fatos                 | sem marca               |
| `DERIVED`  | cálculo do backend sobre fatos observados | sem marca               |
| `PROXY`    | aproximação por outra entidade            | **marca discreta**      |
| `MOCK`     | valor não observado                       | **marca explícita**     |

Read Models inteiros também declaram procedência:
`EnvironmentalImpactReadModel.source = 'MOCK_DERIVED'` e
`WeatherEnvironmentalIntelligenceReadModel.source = 'MOCK'`.

Onde isso vive: `frontend/src/metrics/metric-registry.ts` (web) e
`ProvenanceChip` em `mobile/lib/core/widgets/section_states.dart`.

---

## 8. Versionamento e compatibilidade

A versão oficial é `/api/v1`. As rotas sem prefixo continuam publicadas como
legadas durante a janela de migração. Web e novas configurações do Flutter já
usam a v1; autenticação, autorização, RLS e envelope são idênticos nas duas.

### Regras de evolução compatível

Seguras, não exigem ação nos clientes:

- **acrescentar** campo opcional a uma resposta;
- **acrescentar** parâmetro opcional a uma query;
- **acrescentar** endpoint;
- **acrescentar** valor a um literal **desde que** os clientes já tratem
  desconhecidos (o mobile trata: `OperationStatus.label` devolve a chave crua;
  o web idem).

Quebram consumidores:

- remover ou renomear campo de resposta;
- tornar obrigatório um parâmetro que era opcional;
- alterar o tipo de um campo;
- alterar o formato do envelope;
- endurecer validação (`ValidationPipe` usa `forbidNonWhitelisted`: um
  parâmetro extra vira 400).

### Procedimento para mudança incompatível

1. Adicionar o novo campo **ao lado** do antigo; nunca substituir de imediato.
2. Rodar `npm run contracts:sync` no web e atualizar o espelho do mobile.
3. Publicar a versão do app que lê o campo novo com fallback para o antigo.
4. Só remover o antigo depois que a telemetria mostrar adoção suficiente.

Estratégia completa de depreciação e catálogo de Read Models:
`backend/docs/api-v1-public-read-models.md`.

---

## 9. Lacunas conhecidas

Ausências de contrato levantadas pelos clientes, sem contorno improvisado:

| Lacuna                                                                                                                               | Impacto                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| ~~Sem endpoint de **membros do tenant**~~                                                                                            | **corrigido na PR-12**: `GET /organizations/current/members` publica o recorte necessário para atribuir                  |
| Sem **ordenação** em `OperationQueryDto`                                                                                             | nenhum cliente oferece ordenar a lista                                                                                   |
| Sem **comentários** em operações                                                                                                     | seção não existe em nenhum cliente                                                                                       |
| Sem `operationId` em `EventQueryDto`                                                                                                 | não há agenda vinculada à operação                                                                                       |
| `Operation.location` é JSON **sem esquema**                                                                                          | mobile só calcula distância quando o tenant gravou coordenadas                                                           |
| `Credential.mustChangePassword` existe mas não é exposto                                                                             | troca obrigatória de senha inerte no web                                                                                 |
| Sem troca de **organização ativa**                                                                                                   | multi-tenant preparado, mas inativo                                                                                      |
| Sem severidade em `Notification`                                                                                                     | mobile apresenta `type`, sem inventar gravidade                                                                          |
| ~~`POST /artifact-templates/:id/versions` responde **500**~~                                                                         | **corrigido na PR-13**: `$queryRaw` sobre `pg_advisory_xact_lock` trocado por `$executeRaw`; publicar versão devolve 201 |
| Sem nível de **agrupamento** dentro de seção                                                                                         | o Studio modela grupos, mas o contrato só tem `sections[].fields[]`                                                      |
| Sem `purpose` de geração de template em `ai-executions`                                                                              | não há contrato para geração de estrutura assistida por IA                                                               |
| **`AgendaQueryDto` não aceita fuso** — a agenda agrupa em UTC                                                                        | evento noturno cai no dia errado fora de UTC; o web calcula a janela no fuso da unidade                                  |
| Sem Read Model de evento, calendário e disponibilidade em `scheduling`                                                               | formas espelhadas do `include` do Prisma — quebram em runtime, não na compilação                                         |
| `OrganizationContextReadModel` sem `timezone`                                                                                        | o fuso da agenda vem da unidade; sem unidade, do navegador                                                               |
| `GET /scheduling/intelligence` é fixture (`source: 'MOCK'`)                                                                          | apresentado com marca de não observado; só `conflicts` é real                                                            |
| `EventQueryDto` sem filtro por `type` e sem busca textual                                                                            | a agenda não oferece esses filtros                                                                                       |
| Módulo `assets` sem Read Model e sem `criticality`                                                                                   | forma espelhada do Prisma; a tela não oferece filtro nem coluna de criticidade                                           |
| Analytics não aceita `assetId`                                                                                                       | indicadores do ativo saem do `meta.total` de consultas filtradas; MTBF e disponibilidade não têm fonte                   |
| Sem histórico e sem inteligência com escopo de ativo                                                                                 | os painéis declaram a ausência                                                                                           |
| Sem contrato de **branding** — `UpdateOrganizationDto` aceita só nome, segmento e `settings`                                         | branding vive em `settings` (JSON livre), por convenção do tenant                                                        |
| `timezone`, `locale`, `currency` e `status` de unidade são publicados mas **não editáveis**                                          | não há ativar/desativar unidade; `UpdateBusinessUnitDto` é `PartialType(CreateBusinessUnitDto)`                          |
| Sem listagem de **papéis** (`roleId` exigido no convite)                                                                             | convidar usuário não é oferecido na interface                                                                            |
| STARTER não concede `business_units.*`                                                                                               | administração de unidades inacessível no único plano semeado                                                             |
| `CustomerQueryDto` sem filtro por unidade, cidade ou responsável                                                                     | a listagem de clientes não os oferece; cidade fica em `address` (JSON sem esquema)                                       |
| ~~Sem Read Model de cliente; `deletedAt` exposto~~                                                                                   | **corrigido na PR-11**: `CustomerReadModel` + mapper; `deletedAt` e `_count` não são mais publicados                     |
| **Realtime de notificações inalcançável pelo web** — o gateway Socket.IO exige token no handshake, e o web só tem cookies `HttpOnly` | a central usa polling configurável; o mobile pode usar o gateway                                                         |
| `NotificationQueryDto` sem busca textual; sem arquivar, fixar ou prioridade                                                          | a central não oferece esses conceitos                                                                                    |
| Sem Read Model de notificação; `payload` sem esquema                                                                                 | forma espelhada; a Resource Reference é lida com tolerância                                                              |
| Analytics não aceita `customerId`                                                                                                    | receita, ticket médio e tempo de resposta não têm fonte                                                                  |
| ~~Anexos de execução não recebem binário — só `storageKey`~~                                                                         | **corrigido na PR-19**: `POST /attachments/upload-url` reserva o objeto e devolve URL de upload assinada                 |
| Sem leitura de auditoria e sem histórico de execução de artefato                                                                     | painel de histórico declara ausência                                                                                     |
| Analytics **sem domínio de execução de artefato**                                                                                    | os KPIs do Execution Center vêm de contagens por fila (`meta.total`)                                                     |
| Sem progresso agregado de execuções                                                                                                  | nenhum "progresso global" é exibido; o progresso é por execução                                                          |
| Execução **não tem status `CANCELLED`**                                                                                              | não há fila de canceladas; `ARCHIVED` é outra coisa                                                                      |
| Sem rota que liste insights de várias execuções                                                                                      | inconsistências permanecem no Workspace da execução                                                                      |
| Sem canal de tempo real para execuções                                                                                               | polling declarado na tela; nada simula WebSocket                                                                         |
| `ArtifactExecutionQueryDto` sem ordenação, `groupBy`, `templateId` ou `artifactType`                                                 | agrupamento só por status, no servidor                                                                                   |
| Sem endpoint de catálogo oficial de templates                                                                                        | o oficial é encontrado na própria listagem, filtrando por tipo                                                           |
| `visibility` de criação aceita só `PRIVATE`/`ORGANIZATION`                                                                           | template global só nasce por semeadura da plataforma                                                                     |
| Sem rota de reversão de versão de template                                                                                           | restaurar é publicar versão nova com o conteúdo antigo                                                                   |
| **Sem domínio financeiro** — nenhum modelo de lançamento, receita, despesa ou previsão                                               | o painel de Saúde Financeira declara a ausência; nenhum número é estimado                                                |
| Analytics não segmenta por `OperationKind` nem publica produtividade por técnico                                                     | o radar comparativo declara os eixos que não existem                                                                     |
| `equipment.availability` e `contracts.active_proxy` são contados **sem filtro de data**                                              | ficam fora de comparações período a período; marcados no Metric Registry                                                 |
| **Nada cria calendário** no cadastro da organização, e `calendarId` é obrigatório                                                    | a agenda oferece criar o primeiro (corrigido na PR-12); sem isso, agendar era impossível                                 |
| Janela do Scheduling limitada a **366 dias**                                                                                         | a central de lembretes consulta doze meses e declara a janela                                                            |
| `SchedulingEvent` sem `isActive`                                                                                                     | ativar/desativar lembrete usa `status` (`CONFIRMED`/`CANCELLED`)                                                         |
| Nenhuma automação reage à conclusão de operação                                                                                      | lembrete de retorno é criado por pessoa; evolução proposta em `ux-improvements.md`                                       |
| Sem endpoint de **troca de responsável** de operação                                                                                 | reatribuir é atribuir e depois desatribuir                                                                               |
| Operação **não passa pelo motor de agenda**                                                                                          | a janela prevista é informativa; nenhum conflito é avaliado                                                              |
| Sem campo nem filtro de **autorização** em `Operation`                                                                               | a preferência é gravada em `settings` e o backend ainda não a aplica — avisado na tela                                   |
| ~~Sem motor de renderização — `renderStatus` é sempre `NOT_RENDERED`~~                                                               | **corrigido na PR-20**: HTML e PDF renderizam, e `renderStatus` é persistido pelo backend                                |
| ~~Sem fila ou job assíncrono para renderização~~                                                                                     | **corrigido na PR-20**: fila sobre Postgres com `SKIP LOCKED`, retry, backoff e dead-letter                              |
| Sem comparação (diff) entre revisões de manifest                                                                                     | o contrato publica o necessário; o diff não foi implementado                                                             |
| Sem assinatura digital do documento emitido                                                                                          | `contentHash` é o valor que ela cobrirá                                                                                  |
| Azure Blob e Google Cloud Storage não implementados                                                                                  | a configuração os recusa explicitamente em vez de fingir suporte                                                         |
| Sem política de retenção de objeto                                                                                                   | `remove` é recusado no provider S3: documento emitido não some por ação da aplicação                                     |
| Sem DOCX e sem PDF/A                                                                                                                 | são renderizadores novos; o registry os aceita sem mudar pipeline                                                        |
| Sem assinatura digital no PDF emitido                                                                                                | `contentHash` é o valor que ela cobrirá; falta o certificado                                                             |
| Chromium/Puppeteer avaliado e não adotado                                                                                            | pdfkit já é dependência; a troca é um provider novo                                                                      |
| Sem cancelamento de renderização em curso                                                                                            | o job termina; corrigir é abrir a revisão seguinte                                                                       |
| Job em `DEAD` não tem rota de reenfileiramento                                                                                       | permanece na tabela com o último erro, para investigação                                                                 |
| Métricas de renderização são por processo                                                                                            | não somam entre réplicas; o log estruturado é a fonte para um coletor                                                    |
| ~~`renderStatus` da execução era constante `NOT_RENDERED`~~                                                                          | **corrigido na PR-14**: o mapper publica o valor persistido pela PR-20                                                   |
| Sem listagem global de manifests                                                                                                     | o Document Center parte das execuções                                                                                    |
| `ArtifactExecutionQueryDto` não filtra por `renderStatus`                                                                            | as filas da central contam a página carregada, e a tela declara isso                                                     |
| Sem busca pelo conteúdo do documento nem filtro por formato/renderizador                                                             | a central oferece só a busca que o backend suporta                                                                       |
| Sem endpoint de catálogo de renderizadores                                                                                           | a lista vem de `/artifact-rendering/metrics`                                                                             |
| Sem contrato de compartilhamento de documento                                                                                        | a ação é declarada indisponível no Document Registry                                                                     |

---

## 10. Onde encontrar cada coisa

| Assunto                                         | Documento                                       |
| ----------------------------------------------- | ----------------------------------------------- |
| BFF, cliente HTTP e Query Layer (web)           | `frontend/docs/frontend-core.md`                |
| Autenticação e sessão (web)                     | `frontend/docs/authentication.md`               |
| Dashboard e procedência (web)                   | `frontend/docs/dashboard.md`                    |
| Metric Registry (web)                           | `frontend/docs/metric-registry.md`              |
| Artifact Studio (web)                           | `frontend/docs/artifact-studio.md`              |
| Artifact Execution Workspace (web)              | `frontend/docs/artifact-execution-workspace.md` |
| Operations Workspace (web)                      | `frontend/docs/operations-workspace.md`         |
| Scheduling Workspace (web)                      | `frontend/docs/scheduling-workspace.md`         |
| Asset Workspace (web)                           | `frontend/docs/asset-workspace.md`              |
| Entity Registry (web)                           | `frontend/docs/entity-registry.md`              |
| Organization Workspace (web)                    | `frontend/docs/organization-workspace.md`       |
| Action Registry — preparação (web)              | `frontend/docs/action-registry.md`              |
| Customer Workspace (web)                        | `frontend/docs/customer-workspace.md`           |
| Registry Core — proposta (web)                  | `frontend/docs/registry-core.md`                |
| Notification Center (web)                       | `frontend/docs/notification-center.md`          |
| UX Improvements — Fase 1 (web)                  | `frontend/docs/ux-improvements.md`              |
| Template Type Registry (web)                    | `frontend/docs/template-type-registry.md`       |
| Artifact Studio V2 (web)                        | `frontend/docs/artifact-studio-v2.md`           |
| Execution Center (web)                          | `frontend/docs/execution-center.md`             |
| Artifact Manifest (backend)                     | `backend/docs/artifact-manifest.md`             |
| Storage Provider e URLs assinadas (backend)     | `backend/docs/artifact-storage.md`              |
| Artifact Rendering Engine (backend)             | `backend/docs/artifact-rendering.md`            |
| Registry Kernel (web)                           | `frontend/docs/registry-kernel.md`              |
| Workspace Core e Navigation Core (web)          | `frontend/docs/workspace-core.md`               |
| Document Registry (web)                         | `frontend/docs/document-registry.md`            |
| Document Center (web)                           | `frontend/docs/document-center.md`              |
| Arquitetura, fila de uploads e offline (mobile) | `mobile/README.md`                              |
| Administração da plataforma                     | `backend/docs/platform-administration.md`       |
