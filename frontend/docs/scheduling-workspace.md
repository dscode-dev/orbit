# Scheduling Workspace

Agenda operacional do Orbit: operações, visitas técnicas, PMOCs, manutenções,
compromissos, bloqueios e disponibilidade de operadores. Consome exclusivamente
o módulo `scheduling` (PR-14), pelo BFF.

|              |                                                                                                                                   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Rota         | `/agenda`                                                                                                                         |
| Capabilities | `scheduling.read` para abrir, `scheduling.manage` para escrever, `scheduling.intelligence` para o painel de inteligência          |
| Permissões   | `scheduling.read` · `scheduling.events.create/update/delete` · `scheduling.allocations.manage` · `scheduling.availability.manage` |
| Contratos    | `src/types/contracts/modules/scheduling/` (sincronizados) + formas espelhadas declaradas em `src/types/scheduling.ts`             |

---

## 1. Fluxo

```
fuso da unidade  ──>  janela da visão  ──>  query key  ──>  hooks
                                                              │
                                                        apiClient
                                                              │
                                            BFF  /api/orbit/scheduling/**
                                                              │
                                                     NestJS  /scheduling/**
                                                              │
                          ocorrências · conflitos · disponibilidade · inteligência
                                                              │
                                              normalização por dia local
                                                              │
                                        dia · semana · mês · lista
```

O fuso e a janela entram na query key: trocar de período ou de unidade é uma
consulta nova, e voltar ao período anterior reaproveita o cache.

As quatro visões recebem `ReadonlyMap<string, DayBucket>` e não conhecem
endpoint algum — é o que permitirá reaproveitá-las no aplicativo móvel, com
cache offline, sem tocar em nenhuma grade.

---

## 2. Endpoints utilizados

| Endpoint                                   | Uso                                                      |
| ------------------------------------------ | -------------------------------------------------------- |
| `GET /scheduling/events`                   | **fonte de todas as visões** — ocorrências já expandidas |
| `GET /scheduling/conflicts`                | painel de conflitos e marca nos blocos da grade          |
| `GET /scheduling/availability`             | painel de disponibilidade                                |
| `GET /scheduling/calendars`                | filtro e seletor do formulário                           |
| `GET /scheduling/events/:id`               | detalhe — única leitura com **nomes**                    |
| `GET /scheduling/events/:id/timeline`      | histórico do evento, com autor                           |
| `POST /scheduling/events`                  | criação, com recorrência e alocações                     |
| `PATCH /scheduling/events/:id`             | edição e **cancelamento** (`status: CANCELLED`)          |
| `DELETE /scheduling/events/:id`            | exclusão lógica                                          |
| `POST /scheduling/calendars`               | criação de calendário                                    |
| `POST` · `DELETE /scheduling/availability` | regras de disponibilidade                                |
| `GET /scheduling/intelligence`             | painel de inteligência (ver §6)                          |
| `GET /customers` · `GET /assets`           | seletores dos filtros de cliente e ativo                 |

Não consumidos: `POST/DELETE /scheduling/events/:id/allocations` (a alocação é
enviada junto do evento no formulário; gerenciá-la avulsa é fluxo de escala) e
`GET /scheduling/dashboard`, que já é consumido pelo Dashboard.

---

## 3. A incompatibilidade de fuso — e o que foi feito

Este é o ponto que define a arquitetura da tela.

`GET /scheduling/agenda` existe, devolve os dias agrupados e traz um `summary`
pronto. **Mas agrupa em UTC:**

```ts
// scheduling.service.ts
private viewRange(view: string, date: Date) {
  const from = new Date(date);
  from.setUTCHours(0, 0, 0, 0);      // meia-noite UTC, não local
  …
}
const date = event.startsAt.slice(0, 10);   // dia em UTC
```

Para um tenant em `America/Recife` (UTC−3), a visão "do dia 5" vai das 21h do
dia 4 às 21h do dia 5, e uma visita das 22h cai no balde do dia seguinte.

**Verificado contra a API real**, com uma visita às 22:00 de 05/08 em
`America/Recife` (= `2026-08-06T01:00Z`):

```
agenda?view=DAY&date=2026-08-05  →  janela 05T00:00Z → 06T00:00Z  ·  nenhum evento
agenda?view=DAY&date=2026-08-06  →  janela 06T00:00Z → 07T00:00Z  ·  dia "2026-08-06"
```

A visita **desaparece** do dia em que ela acontece para quem a agendou.

Por isso o Workspace usa `GET /scheduling/events?from&to`, com os limites da
janela calculados no fuso da unidade (`lib/scheduling/view-window.ts`), e
agrupa por dia local (`lib/scheduling/normalize.ts`). Na mesma verificação, a
janela local (`05T03:00Z → 06T03:00Z`) devolve a visita corretamente.

**Isso não move regra de negócio para o cliente.** Quais eventos existem, como
a recorrência se expande, o que é conflito e quem está disponível continuam
sendo respostas do servidor. O que se decide aqui é o recorte da consulta e em
que dia da tela cada ocorrência aparece — apresentação.

**Correção sugerida no backend:** aceitar `timezone` em `AgendaQueryDto` e usar
`Intl` para os limites e para a chave do dia. Com isso o agrupamento volta ao
servidor e o `summary` volta a ser utilizável.

### Demais decisões de tempo

- **Datas saem em ISO com fuso explícito.** O campo `datetime-local` devolve
  hora de parede; a conversão passa por `instantFromZoned` no fuso da visão, e
  não por `new Date(...)`, que a leria no fuso do navegador.
- **A origem do fuso é declarada na tela.** `BusinessUnitReadModel.timezone`
  existe; `OrganizationContextReadModel` **não tem** campo de fuso. A resolução
  vai da unidade ativa → unidade principal → navegador, e o rótulo diz qual foi.
- **Eventos que cruzam a meia-noite** são recortados por dia, com marca de
  continuação (`↑`/`↓`) em cada trecho.
- **Eventos de dia inteiro** ficam na faixa acima da grade de horas.
- **Evento em fuso diferente do da visão** mostra também o horário no fuso
  dele — a agenda de uma organização com unidades em fusos distintos não pode
  esconder isso.

---

## 4. Sem biblioteca de calendário

Antes de considerar uma dependência, o que a grade precisa foi comparado ao que
já existe:

| Necessidade                  | Como foi resolvido                              |
| ---------------------------- | ----------------------------------------------- |
| Posicionar blocos por minuto | aritmética sobre `startMinute`/`endMinute`      |
| Distribuir sobreposições     | varredura em faixas (`assignLanes`), ~25 linhas |
| Grade do mês                 | `Popover`, `Card` e CSS grid do Design System   |
| Escolher datas               | `datetime-local` nativo                         |
| Fuso                         | `Intl.DateTimeFormat`                           |

Uma biblioteca de calendário traria seu próprio modelo de evento, seu próprio
tratamento de fuso e seu próprio motor de recorrência — justamente as três
coisas que aqui pertencem ao servidor. Nenhuma dependência foi adicionada.

A grade de horas é um componente só (`TimeGrid`), parametrizado pelo número de
colunas: a visão do dia usa uma, a da semana usa sete.

---

## 5. Onde mora a autoridade

| Decisão                                 | Quem decide                                 |
| --------------------------------------- | ------------------------------------------- |
| Quais ocorrências existem em uma janela | backend (`occurrences`)                     |
| Como a recorrência se expande           | backend (`RecurrenceEngine`)                |
| O que é conflito e qual a severidade    | backend (`conflicts`)                       |
| Se um conflito **bloqueia** a escrita   | backend (`assertConflicts` — só `CRITICAL`) |
| Quem está disponível                    | backend (regras de `availability`)          |
| Se a janela do evento é válida          | backend (`validateEvent`)                   |
| Se o usuário pode agendar               | backend (`@Permissions`, `@Capabilities`)   |

Verificado contra a API real:

```
sobreposição simples de eventos     →  criada · conflito WARNING (não bloqueia)
mesmo operador em horário sobreposto →  409 CONFLICT · RESOURCE_OVERLAP (CRITICAL)
o mesmo, com allowConflicts: true    →  criada
recorrência semanal, count 4         →  4 ocorrências expandidas pelo servidor
```

O formulário reage ao 409 oferecendo reenviar com `allowConflicts: true` — a
bandeira que o próprio contrato define para "ciente do conflito, siga assim".
Nenhuma sobreposição é avaliada no frontend.

**Cancelar não é excluir.** Não há rota de cancelamento: cancelar é `PATCH` com
`status: "CANCELLED"`, que preserva o evento na agenda com o status riscado;
`DELETE` faz exclusão lógica e some da agenda. As duas ações existem, com a
diferença explicada na tela.

---

## 6. Scheduling Intelligence — o que é observado e o que não é

O contrato declara `source: 'MOCK'`, e o controller anuncia _"Return mocked
Scheduling Intelligence contracts"_. Olhando o serviço, os blocos têm
procedências diferentes:

| Bloco                         | Procedência                                                       |
| ----------------------------- | ----------------------------------------------------------------- |
| `conflicts`                   | **observado** — mesmo cálculo de `/scheduling/conflicts`          |
| `reschedulingRecommendations` | conflito real + horário fixo (`fim + 30 min`, confiança 0,78)     |
| `routeOptimizations`          | números fixos no código (14%, 38 min)                             |
| `delayPredictions`            | probabilidades fixas (`0,42 + 0,13·i`)                            |
| `weatherImpact`               | derivado do nome do segmento; **não há integração meteorológica** |

Pela regra firmada na PR-03, valor marcado como `MOCK` não pode ser apresentado
como observação real. Então:

- os **conflitos** aparecem no painel próprio, com os dados reais de
  `/scheduling/conflicts`;
- o painel de inteligência traz marca "não observado" no cabeçalho, um aviso
  citando o `source` que veio na resposta, e cada bloco identificado pelo que é.

Confirmado na API: `source = 'MOCK'`, com 3 conflitos reais e os demais blocos
preenchidos com os valores fixos previstos no código.

---

## 7. Invalidação de cache

Escrever um evento muda, potencialmente, **todas** as janelas: um recorrente
criado hoje aparece em semanas futuras, e mover um evento muda o conflito de
outro. Não existe invalidação por período que seja correta, então toda escrita
invalida a raiz do módulo (`queryKeys.module("scheduling")`).

É deliberado: invalidar só o período visível deixaria janelas vizinhas em cache
mostrando um evento que não existe mais. O custo é refazer as consultas do
módulo; o benefício é nunca exibir agenda mentindo.

Organização e unidade são tratadas uma camada acima — o `RequestContextProvider`
(PR-02) descarta o cache ao trocar de organização, e a unidade entra na query
key por ser filtro real de `EventQueryDto`.

---

## 8. Lacunas e incompatibilidades encontradas

| Item                                                                                                   | Consequência na tela                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`AgendaQueryDto` não aceita fuso**; agenda agrupa em UTC                                             | a tela não usa `/scheduling/agenda`; janela e agrupamento são calculados no fuso da unidade (§3)                                                             |
| **Sem endpoint de membros do tenant**                                                                  | o filtro de operador oferece apenas "alocados a mim"; um seletor de equipe depende de `GET /organizations/current/members`                                   |
| **Sem Read Model de evento, calendário e disponibilidade** — o controller devolve o registro do Prisma | as formas são **espelhadas** em `src/types/scheduling.ts`, com acesso tolerante a nulo; mudança silenciosa no `include` quebra em runtime, não na compilação |
| **`OrganizationContextReadModel` não tem `timezone`**                                                  | o fuso vem da unidade; sem unidade, cai no navegador e a tela declara isso                                                                                   |
| **`GET /scheduling/intelligence` é fixture** (`source: 'MOCK'`)                                        | painel marcado como não observado, com os conflitos reais isolados no painel próprio                                                                         |
| **Sem paginação em `/scheduling/events`**                                                              | a janela da visão limita o volume; um mês com milhares de ocorrências chegaria inteiro                                                                       |
| **`EventQueryDto` não filtra por `type`**                                                              | o filtro de tipo não é oferecido — filtrar no cliente recortaria só o que foi carregado                                                                      |
| **Sem busca textual em eventos**                                                                       | não há campo de busca na agenda                                                                                                                              |
| Sobreposição simples é `WARNING` e **não bloqueia**                                                    | esperado do contrato; a tela mostra o aviso sem impedir                                                                                                      |
| `location` do evento é JSON livre                                                                      | apresentado como JSON no detalhe, sem mapa                                                                                                                   |

---

## 9. Verificação contra a API real

Sequência executada contra o backend em `docker compose`, com organização,
unidade (`America/Recife`) e calendário reais:

```
criar calendário                          ✓
evento às 22:00 locais (01:00Z do dia seguinte)   ✓
agenda?view=DAY&date=05/08                ✓  nenhum evento    ← agrupamento UTC
agenda?view=DAY&date=06/08                ✓  dia "2026-08-06"
events?from/to na janela local de 05/08   ✓  evento presente  ← janela no fuso
recorrência semanal, count 4              ✓  4 ocorrências expandidas
sobreposição simples                      ✓  WARNING, não bloqueia
mesmo operador sobreposto                 ✓  409 CONFLICT (CRITICAL)
o mesmo com allowConflicts                ✓  criado
criar e listar disponibilidade            ✓  BLOCKED, terça, 08:00–17:00
intelligence                              ✓  source MOCK, 3 conflitos reais
```

---

## 10. O que **não** foi implementado no frontend

- nenhuma expansão de recorrência — a regra é montada, a expansão é do
  `RecurrenceEngine`, e por isso não há preview de ocorrências futuras;
- nenhuma detecção de conflito — as sobreposições desenhadas na grade são
  layout, não julgamento;
- nenhum cálculo de disponibilidade — o painel mostra as regras, o servidor as
  aplica;
- nenhuma recomendação gerada localmente;
- nenhum componente novo no Design System.
