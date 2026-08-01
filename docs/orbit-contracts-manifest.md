# Orbit Contracts Manifest

Referência arquitetural dos contratos compartilhados entre os clientes do
Orbit. Quem for alterar o backend consulta este documento para saber **quem
quebra**; quem for construir um cliente novo consulta para saber **o que
existe**.

| Papel | Stack | Como fala com o backend |
| --- | --- | --- |
| Backend | NestJS + Prisma + PostgreSQL (RLS) | — |
| Frontend Web | Next.js 16 (App Router) | via BFF próprio (`/api/orbit/**`) |
| Mobile | Flutter 3.44 (Orbit Operator) | direto no NestJS, com Bearer token |

Última revisão: PR Mobile-02.

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
{ "success": true, "data": { }, "requestId": "…", "timestamp": "…" }
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

| Cliente | Onde desembrulha |
| --- | --- |
| Web | `frontend/src/api/http.ts` e `frontend/src/server/backend-client.ts` |
| Mobile | `mobile/lib/core/network/orbit_api_client.dart` |

---

## 3. Contexto de requisição

Cabeçalhos propagados em toda chamada:

| Cabeçalho | Consumo no backend | Web | Mobile |
| --- | --- | --- | --- |
| `authorization` | `JwtAuthenticationGuard` — identidade, escopo, permissões | ✓ (injetado pelo BFF) | ✓ (secure storage) |
| `x-request-id` | `RequestIdInterceptor` — correlação ponta a ponta | ✓ | ✓ |
| `accept-language` | `RequestContextInterceptor` → `RequestContext.locale` | ✓ | ✓ |
| `x-timezone` | propagado; ainda não lido | ✓ | ✓ |
| `x-organization-id` | propagado; ainda não lido | ✓ | — |
| `x-business-unit-id` | propagado; ainda não lido | ✓ | — |
| `x-orbit-client` | propagado; ainda não lido | — | ✓ (`MOBILE`) |

**O escopo efetivo vem das claims do JWT**, não desses cabeçalhos. Eles servem
para correlacionar logs e para o backend passar a validá-los sem mudança nos
clientes.

---

## 4. Origem dos DTOs

| Conjunto | Origem | Web | Mobile |
| --- | --- | --- | --- |
| Tipos e literais base | `backend/src/contracts/**` | **sincronizado** por `npm run contracts:sync` → `frontend/src/types/contracts/` | **espelhado à mão** em `mobile/lib/core/contracts/` |
| Read Models (dashboards, analytics, scheduling) | `backend/src/modules/*/[modulo].read-models.ts` | **sincronizado** (mesmo script) | espelhado à mão (recorte usado) |
| Respostas de Operations, Identity, Organizations | payloads do Prisma montados por `include`/`select` — **o backend não exporta tipo** | declarado em `frontend/src/types/operations.ts` | declarado em `mobile/lib/core/contracts/` |

### Consequência prática

Há **dois níveis de acoplamento**:

- **Sincronizado** (contracts + read models): o backend é fonte única; o
  cliente regenera. Renomear um campo aqui quebra a compilação do web na hora,
  que é o comportamento desejado.
- **Espelhado**: o cliente reproduz um `include` do repositório. Mudança
  silenciosa no `select` **não** quebra a compilação — quebra em runtime, com
  campo nulo. É o ponto frágil do contrato hoje.

**Recomendação de evolução:** publicar Read Models explícitos para Operations e
Identity, como já existe em dashboards/analytics/scheduling. Isso move esses
DTOs do nível "espelhado" para "sincronizado".

---

## 5. Contratos públicos

Marcados com `@Public()` — acessíveis sem sessão.

| Endpoint | Uso | Web | Mobile |
| --- | --- | --- | --- |
| `POST /identity/login` | autenticação | ✓ | ✓ |
| `POST /identity/register` | onboarding público | ✓ | — |
| `POST /identity/refresh` | rotação de tokens | ✓ | ✓ |
| `POST /identity/password/forgot` | recuperação | ✓ | — |
| `POST /identity/password/reset` | nova senha | ✓ | — |
| `POST /identity/invitations/accept` | aceite de convite | ✓ | — |
| `GET /plans` | escolha de plano no onboarding | ✓ | — |

No web esses passam pelo BFF com uma allowlist explícita
(`frontend/src/server/bff/allowlist.ts`), porque o proxy exige sessão por
padrão. As rotas que emitem token são **bloqueadas** no proxy genérico: iriam
expor o par de tokens ao JavaScript da página.

---

## 6. Contratos internos por cliente

### 6.1 Identidade e sessão

| Endpoint | Web | Mobile |
| --- | --- | --- |
| `GET /identity/me` | ✓ | ✓ |
| `POST /identity/logout` | ✓ | ✓ |
| `GET /organizations/current` | ✓ | ✓ |
| `GET /organizations/current/subscription` | ✓ | ✓ |
| `GET /identity/me/sessions` | — | — |

`GET /organizations/current` exige assinatura ativa (`@RequiresActivePlan`):
responde 403 quando o plano vence. **Ambos os clientes toleram essa falha** e
mantêm a sessão, para mostrar o estado de assinatura bloqueada em vez de
expulsar o usuário.

### 6.2 Operations

| Endpoint | Web | Mobile |
| --- | --- | --- |
| `GET /operations` | ✓ | ✓ |
| `GET /operations/:id` | ✓ | ✓ |
| `GET /operations/:id/timeline` | ✓ | ✓ |
| `GET /operations/:id/history` | ✓ | ✓ |
| `PATCH /operations/:id/status` | ✓ | ✓ |
| `POST /operations/:id/attachments` | ✓ | ✓ (fila resiliente) |
| `GET /operations/:id/attachments/:id` | ✓ | — |
| `DELETE /operations/:id/attachments/:id` | ✓ | — |
| `POST/DELETE /operations/:id/assignments` | parcial | — |
| `GET /checklist-executions?operationId=` | ✓ | ✓ |

### 6.3 Dashboard, Analytics e Scheduling

| Endpoint | Web | Mobile |
| --- | --- | --- |
| `GET /dashboard` | ✓ (autoridade de **layout**) | — |
| `GET /analytics/dashboard` | ✓ | ✓ |
| `GET /analytics/{kpis,trends,health,forecasts}` | ✓ | — |
| `GET /analytics/environmental-impact` | ✓ | — |
| `GET /analytics/intelligence` | ✓ | — |
| `GET /scheduling/agenda` | ✓ | ✓ |
| `GET /ai-executions?operationId=` | ✓ | ✓ |
| `GET /notifications` | — | ✓ |

**Nota importante sobre `GET /dashboard`:** o campo `widget.data` é fixture no
backend (`DashboardRepository.read()` devolve dados escritos no código; só
`context()` consulta o banco). O web o usa como autoridade de *layout* e busca
os números no Analytics. Qualquer cliente novo deve fazer o mesmo.

---

## 7. Procedência dos indicadores

`AnalyticsKpi.dataQuality` classifica cada número:

| Valor | Significado | Tratamento nos clientes |
| --- | --- | --- |
| `OBSERVED` | contagem direta dos fatos | sem marca |
| `DERIVED` | cálculo do backend sobre fatos observados | sem marca |
| `PROXY` | aproximação por outra entidade | **marca discreta** |
| `MOCK` | valor não observado | **marca explícita** |

Read Models inteiros também declaram procedência:
`EnvironmentalImpactReadModel.source = 'MOCK_DERIVED'` e
`WeatherEnvironmentalIntelligenceReadModel.source = 'MOCK'`.

Onde isso vive: `frontend/src/metrics/metric-registry.ts` (web) e
`ProvenanceChip` em `mobile/lib/core/widgets/section_states.dart`.

---

## 8. Versionamento e compatibilidade

Hoje **não há versionamento de API**: não existe prefixo `/v1`, nem cabeçalho
de versão, nem negociação de conteúdo. Os clientes consomem o contrato corrente.

Consequência: **toda mudança incompatível é imediata para todos**. E o mobile é
o caso crítico — uma versão instalada continua chamando o contrato antigo por
semanas, porque o usuário controla a atualização.

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

**Recomendação:** introduzir versionamento (`/v1`) antes que exista base
instalada relevante do mobile. Sem isso, o passo 4 vira aposta.

---

## 9. Lacunas conhecidas

Ausências de contrato levantadas pelos clientes, sem contorno improvisado:

| Lacuna | Impacto |
| --- | --- |
| Sem endpoint de **membros do tenant** | web e mobile não conseguem atribuir técnico (exige `userId`) |
| Sem **ordenação** em `OperationQueryDto` | nenhum cliente oferece ordenar a lista |
| Sem **comentários** em operações | seção não existe em nenhum cliente |
| Sem `operationId` em `EventQueryDto` | não há agenda vinculada à operação |
| `Operation.location` é JSON **sem esquema** | mobile só calcula distância quando o tenant gravou coordenadas |
| `Credential.mustChangePassword` existe mas não é exposto | troca obrigatória de senha inerte no web |
| Sem troca de **organização ativa** | multi-tenant preparado, mas inativo |
| Sem severidade em `Notification` | mobile apresenta `type`, sem inventar gravidade |
| Read Models de Operations/Identity não publicados | DTOs espelhados à mão (seção 4) |

---

## 10. Onde encontrar cada coisa

| Assunto | Documento |
| --- | --- |
| BFF, cliente HTTP e Query Layer (web) | `frontend/docs/frontend-core.md` |
| Autenticação e sessão (web) | `frontend/docs/authentication.md` |
| Dashboard e procedência (web) | `frontend/docs/dashboard.md` |
| Metric Registry (web) | `frontend/docs/metric-registry.md` |
| Operations Workspace (web) | `frontend/docs/operations-workspace.md` |
| Arquitetura, fila de uploads e offline (mobile) | `mobile/README.md` |
| Administração da plataforma | `backend/docs/platform-administration.md` |
