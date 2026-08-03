# UX Improvements — Fase 1 (PR-12)

Quatro frentes: navegação, painel, agenda e operações.

---

## 1. Sidebar por categoria

Os itens foram agrupados por **o que a pessoa está fazendo**:

| Grupo             | Itens                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| **Operação**      | Visão geral, Agenda, Operações, Execuções, Relatórios (em breve)                            |
| **Comercial**     | Clientes, Ativos, Produtos & Serviços (em breve)                                            |
| **Documentos**    | Artefatos                                                                                   |
| **Administração** | Organização, Usuários (em breve), Notificações, Configurações (em breve), Perfil (em breve) |

Nenhum componente, animação, token ou estilo do menu foi alterado — só a
composição da lista.

Duas decisões que valem registro:

- **Os itens de entidade vêm do Entity Registry.** Rótulo, ícone e rota base de
  Clientes, Ativos, Operações, Agenda, Execuções e Artefatos já têm dono.
  Repetir aqui criaria duas verdades e, pior, quebraria o realce do item ativo
  — que compara o rótulo do menu com o `activeLabel` da página, também vindo do
  registry. Por isso "Ativos" e não "Equipamentos": o nome da entidade é o que o
  registry publica, e trocá-lo é uma decisão do registry, não do menu.
- **Itens sem tela ganharam a marca "em breve".** O menu já tinha botões
  inertes ("Relatórios", "Suporte"); a diferença é que agora eles dizem que são.
  "Suporte" saiu por não estar na estrutura pedida.

---

## 2. Dashboard

### 2.1 Radar comparativo

À esquerda da Central de Atenção, ocupando o resto da linha:

```
┌──────────────┬──────────────────────────────┐
│ Radar (4/12) │ Central de Atenção (8/12)    │
└──────────────┴──────────────────────────────┘
```

A posição **não é decidida pelo frontend**. O layout vem de `GET /dashboard`, e
o widget foi registrado no backend com `order: 5` e `size: 'MEDIUM'` — 4 + 8
fecham a linha de 12 colunas. Verificado na API:

```
   5  MEDIUM operations-comparative-radar
  10  LARGE  attention-center
```

**Os números vêm de duas leituras de `GET /analytics/kpis`**, uma por janela.
Nenhum valor é calculado aqui. Em particular, o mês anterior **não** é
reconstruído a partir do `changePercent` do contrato — isso seria inferir um
número que ninguém publicou. Perguntar duas vezes custa uma requisição e
devolve a verdade.

#### Recorte comparado

Mês corrente até hoje contra **o mesmo trecho** do mês anterior. Comparar 1–3 de
agosto com julho inteiro faria agosto parecer sempre pior. O rótulo do painel
diz qual recorte está no gráfico ("1–3 de ago · 1–3 de jul").

As fronteiras de mês são calculadas no **fuso da unidade**. Em `America/Recife`
a diferença para UTC é de três horas: operações abertas na madrugada do dia 1º
cairiam no mês anterior se a fronteira fosse UTC.

#### Quais eixos entram, e por quê só esses

Só indicadores **percentuais** e marcados como `comparable` no Metric Registry:

| Indicador                                | No radar | Motivo                            |
| ---------------------------------------- | -------- | --------------------------------- |
| `operations.completion_rate`             | sim      | percentual, recortado por período |
| `operations.sla_compliance`              | sim      | percentual, recortado por período |
| `pmoc.compliance`                        | sim      | percentual, recortado por período |
| `technicians.assignment_coverage`        | sim      | percentual, recortado por período |
| `equipment.availability`                 | **não**  | contado **sem filtro de data**    |
| `contracts.active_proxy`                 | **não**  | contado sem filtro de data        |
| `operations.total`, `technicians.active` | **não**  | contagem — outra escala           |

`equipment.availability` e `contracts.active_proxy` ficam de fora porque
`AnalyticsRepository.snapshot` consulta `assets` e `customers` **sem recorte
temporal**: perguntá-los para dois meses devolve o mesmo número duas vezes, e
plotá-los sugeriria uma estabilidade que não foi medida. Confirmado na API — os
dois voltaram idênticos nas duas janelas.

As contagens comparáveis aparecem **como números**, abaixo do gráfico. Misturar
"12 operações" com "87%" nos mesmos eixos desenharia uma forma sem significado.

A marca `comparable` mora no **Metric Registry** — é lá que a plataforma decide
como cada métrica é apresentada. Uma métrica percentual nova, publicada pelo
backend e registrada com a marca, entra no radar sozinha.

#### O que foi pedido e não existe

| Eixo pedido              | Situação                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| Ordens de serviço        | o `KpiEngine` não segmenta por `OperationKind`                      |
| Visitas técnicas         | idem                                                                |
| Produtividade            | não publicada — é a mesma ausência do widget "Desempenho da Equipe" |
| Operações concluídas     | existe como **taxa** (`completion_rate`), não como contagem no KPI  |
| PMOCs                    | existe como **taxa** (`pmoc.compliance`) — está no radar            |
| Cobertura de atendimento | existe (`technicians.assignment_coverage`) — está no radar          |

O rodapé do painel declara as ausências em vez de silenciá-las.

### 2.2 Saúde Financeira

**Não há domínio financeiro na plataforma.** Verificado: nenhum modelo de
lançamento, receita, despesa, saldo ou previsão no `schema.prisma`; nenhum
endpoint; os diretórios `dashboards/financial` e `dashboards/panel` existem
vazios no backend. Busca por `financ|revenue|invoic|billing|receita|despesa|
expense|payment` em todo o `src` só encontra preço de plano de assinatura.

Não havia, portanto, "contrato disponível para consumir parcialmente" — nem
saldo, nem evolução mensal.

O painel foi registrado e **declara a ausência**, com o mesmo tratamento que os
widgets de estoque e produção agrícola já recebem. Nenhum número é estimado.
Quando o módulo existir, o registro passa a apontar para o Read Model real sem
mudar posição nem tamanho.

---

## 3. Agenda

Três abas. Visão geral e Calendário são **o mesmo componente** com molduras
diferentes — as visões de dia, semana, mês e lista, o seletor de período, os
filtros e os diálogos são exatamente os mesmos.

| Aba             | O que muda                                                           |
| --------------- | -------------------------------------------------------------------- |
| **Visão geral** | grade + coluna de análise (conflitos, disponibilidade, inteligência) |
| **Lembretes**   | central de configuração                                              |
| **Calendário**  | grade em largura inteira, mês por padrão, sem coluna de análise      |

Cada aba monta e desmonta o seu conteúdo: manter as três vivas deixaria três
conjuntos de consultas em polling ao mesmo tempo.

### 3.1 Correção do seletor de calendário

O seletor não funcionava. **Duas causas independentes**, ambas corrigidas.

#### Causa 1 — a organização não tem calendário nenhum

`CreateEventDto.calendarId` é obrigatório e **nada cria um calendário**: nem o
cadastro da organização, nem qualquer tela. O endpoint
`POST /scheduling/calendars` existe desde a PR-07 e nenhum componente o
consumia.

Verificado no banco antes da correção:

```
 display_name | calendários
 Studio QA    | 1
 Allblue-Labs | 0
 Synapse Tech | 0
```

E reproduzido do zero numa organização recém-registrada pela API:

```
[1] GET /scheduling/calendars → 200, 0 calendários
```

O seletor abria vazio, o botão de salvar ficava desabilitado e não havia saída.

**Correção:** quando a lista está vazia, tanto o workspace quanto o próprio
diálogo oferecem criar o primeiro calendário, para quem tem
`scheduling.calendars.create` — e explicam a situação para quem não tem. A
chave é derivada do nome (o DTO exige `^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$`), e o
fuso é o da unidade ativa. Verificado:

```
[2] POST /scheduling/calendars → 201, isDefault: true
```

#### Causa 2 — diálogo aberto antes de os calendários chegarem

O estado inicial do formulário escolhia o calendário padrão **uma única vez**,
na montagem. Abrindo o diálogo com a consulta ainda em voo, `calendarId` ficava
vazio para sempre — mesmo depois de a lista carregar.

**Correção:** a escolha padrão é adotada quando a lista chega, por ajuste
durante a renderização (o mesmo padrão do Artifact Studio; `set-state-in-effect`
é erro neste repositório). Só age quando ainda não há escolha — o que o usuário
selecionou nunca é sobrescrito.

O seletor também passou a ficar desabilitado com rótulo "Nenhum disponível"
quando a lista está vazia, em vez de abrir um popover vazio.

### 3.2 Central de Lembretes

**Um lembrete é um evento do Scheduling em um calendário próprio.** Não existe
modelo de lembrete no backend, e inventar um no cliente criaria uma entidade que
só aquele navegador conheceria.

Por que um calendário dedicado e não um `type` reservado: `EventQueryDto`
**não filtra por tipo** — verificado, `?type=` devolve
`['property type should not exist']`. Filtra por `calendarId`. Um calendário
dedicado torna a leitura um recorte de servidor.

| Pedido              | Contrato usado                                      |
| ------------------- | --------------------------------------------------- |
| tipo de operação    | `type` do evento (texto livre, com sugestões)       |
| período do lembrete | `startsAt`/`endsAt`, com atalhos de 3, 6 e 12 meses |
| recorrência         | `recurrence` — expandida pelo `RecurrenceEngine`    |
| ativação            | `status`: `CONFIRMED` ativo, `CANCELLED` desativado |

**A ativação merece nota:** o evento não tem campo `isActive`. `CANCELLED` é o
estado que o contrato oferece para "não vale mais", e é o que a central usa —
sem criar bandeira paralela em `metadata`, que nenhuma outra parte do sistema
leria. Verificado: `PATCH /scheduling/events/:id {status: CANCELLED}` → 200.

Uma linha por **regra**, não por ocorrência: o backend expande a recorrência e
devolveria o lembrete semestral várias vezes. A deduplicação é por `eventId`, e
a contagem de ocorrências na janela acompanha a linha.

Editar carrega `GET /scheduling/events/:id`, não a ocorrência: a ocorrência
publica só a marca `recurring`, sem a regra. Salvar a partir dela apagaria a
recorrência que o usuário não viu.

**Janela de doze meses.** O serviço recusa consultas maiores:
`Schedule range cannot exceed 366 days` (verificado com 24 e 36 meses). A
central olha do mês passado até onze meses à frente e declara a janela na tela.

#### Lacuna: nada dispara sozinho

"Concluir uma instalação e gerar automaticamente um lembrete de retorno em 6
meses" exige **automação no backend**. Ela não existe: nenhuma regra, fila ou
job reage a `PATCH /operations/:id/status`.

A central cria e agenda o lembrete; quem o cria é uma pessoa. Os atalhos de 3, 6
e 12 meses tornam o caminho manual curto.

**Evolução mínima proposta:** um assinante do evento de mudança de status em
`OperationService.changeStatus` que, ao ver a transição para `COMPLETED` de uma
operação de tipo configurado, chame o `SchedulingService.createEvent` já
existente com a recorrência desejada. Não exige tabela nova — a configuração
cabe em `Organization.settings`, e o lembrete gerado é um evento comum. O que
falta é o gatilho.

---

## 4. Operações

Duas abas: **Visão geral** (centro de gestão) e **Autorização** (configuração).

### 4.1 Centro de gestão

A lista deixou de ser só leitura. Cada ação chama um endpoint que já existia:

| Ação               | Endpoint                                      | Verificado |
| ------------------ | --------------------------------------------- | ---------- |
| Criar              | `POST /operations`                            | 201        |
| Editar             | `PATCH /operations/:id`                       | 200        |
| Reagendar          | `PATCH /operations/:id` (janela)              | 200        |
| Alterar prioridade | `PATCH /operations/:id` (prioridade)          | 200        |
| Reatribuir         | `POST` + `DELETE /operations/:id/assignments` | 201 / 204  |
| Cancelar           | `PATCH /operations/:id/status`                | 200        |
| Excluir            | `DELETE /operations/:id`                      | —          |

**Transições não são reproduzidas no cliente.** O menu oferece todos os status
do literal e deixa o backend recusar o que não vale. Verificado:

```
PATCH /operations/:id/status {status: SCHEDULED}  (já SCHEDULED)
→ 400  Status transition from SCHEDULED to SCHEDULED is not allowed
```

Reproduzir a máquina de estados aqui criaria uma segunda verdade que
envelheceria na primeira mudança do servidor.

**O status inicial também é do backend:** criar com janela agendada devolveu
`SCHEDULED`, não `OPEN` (verificado). O formulário não oferece o campo.

**Reatribuir é atribuir e desatribuir.** Não existe endpoint de troca. A tela
adiciona primeiro e remove depois, para que a operação não fique sem
responsável se a segunda chamada falhar.

**Acesso rápido** a cliente, equipamento e execuções usa o **Entity Registry**:
nenhuma rota é montada à mão, e uma entidade sem tela registrada não vira link.

Integração com Scheduling: a operação **não passa pelo motor de agenda**. Não
há `operationId` em `SchedulingEvent` nem conflito avaliado sobre operações — a
janela prevista é informativa, e a tela diz isso ao reagendar.

### 4.2 Autorização

Fluxo configurado:

```
Operação criada → Atribuição → [Autorização] → Disponível para execução
```

Desligado por padrão.

**A preferência é persistida de verdade.** `Organization.settings` é JSON livre,
publicado em `GET /organizations/current` e aceito por `PATCH`. A chave é
`operations.requireAssignmentAuthorization`. Verificado:

```
PATCH /organizations/current {settings:{operations:{requireAssignmentAuthorization:true}}} → 200
GET  /organizations/current  → {"operations": {"requireAssignmentAuthorization": true}}
```

A escrita **preserva o resto de `settings`**: o serviço do backend faz
`settings: input.settings`, ou seja, substitui o objeto inteiro. Enviar só a
chave apagaria o que outra tela gravou.

**A aplicação da regra não existe**, e a tela diz isso em destaque:

- `Operation` não tem campo de autorização;
- `OperationQueryDto` não filtra por ela — verificado,
  `?requiresAuthorization=true` → `['property requiresAuthorization should not exist']`;
- `POST /operations/:id/assignments` atribui sem estado pendente.

Ligar a chave **não esconde nada de ninguém ainda**. Filtrar apenas nesta tela
seria pior: daria falsa sensação de controle, e quem executa continuaria vendo
tudo pelo aplicativo e pela API.

**Evolução mínima proposta:** `authorizedAt` e `authorizedById` na tabela
`operations`, um `PATCH /operations/:id/authorization`, e um filtro em
`OperationQueryDto` que o serviço aplique quando a organização tiver a chave
ligada. Três campos e uma rota; a máquina de status não muda.

Configuração é deliberadamente **única**: por unidade, por tipo ou por técnico
não existe no contrato, e oferecer seria invenção, não granularidade.

---

## 5. Alterações no backend

Três, todas mínimas e no ponto de extensão previsto pela arquitetura.

### 5.1 Widget do radar (`widget-registry.ts`, +24 linhas)

**Motivo:** a posição e o tamanho dos widgets são publicados por
`GET /dashboard`; o frontend não decide o que aparece nem onde. Colocar o radar
"à esquerda da Central de Atenção ocupando o resto da linha" pelo cliente
quebraria essa invariante. O registro do backend é o ponto de extensão previsto.

`readModel` cai no `default` de `DashboardRepository.read()`, que devolve o Read
Model genérico de segmento — igual aos demais widgets alimentados pelo Analytics.
Nenhum código de leitura foi tocado.

`requiredModules` ficou vazio de propósito: é conferido contra as `moduleTags`
do plano, e o STARTER — único plano ativo — não tem nenhuma. Exigir `operations`
esconderia o radar de todo mundo, como já acontece com a Tendência Operacional.

### 5.2 Widget financeiro (`widget-registry.ts`, +14 linhas)

**Motivo:** mesmo ponto de extensão. O painel foi pedido; a ausência de módulo
financeiro fica visível no lugar certo, em vez de silenciosa.

### 5.3 `GET /organizations/current/members` (novo)

**Motivo:** reatribuir técnico é requisito do Stage 4 e era **impossível**.
`POST /operations/:id/assignments` recebe um `userId`, e **nenhuma rota da API
publicava usuários** — não existe controller `users`, e `identity/me` só devolve
o próprio perfil. Sem essa leitura, a reatribuição seria um campo de UUID cru.

É a menor alteração possível: leitura pura, no controller que já existe, com
Read Model e mapper explícitos como o resto do módulo.

```ts
GET /organizations/current/members
→ [{ userId, displayName, email, avatarUrl, status, role, joinedAt, isOwner }]
```

Publica o recorte necessário para atribuir trabalho e nada além — sem
credencial, verificação de e-mail, último acesso ou marca de exclusão.
Associações removidas ficam de fora: quem saiu não recebe trabalho novo.

Verificado: `200`, um membro `OWNER`, `isOwner: true`.

**Não** foi criado: convidar, remover, trocar papel. Nada disso era necessário
para esta PR.

---

## 6. Limitações encontradas

| Limitação                                                                  | Onde aparece                    |
| -------------------------------------------------------------------------- | ------------------------------- |
| Sem domínio financeiro no backend                                          | painel declara a ausência       |
| Analytics não segmenta por `OperationKind`                                 | rodapé do radar                 |
| Analytics não publica produtividade por técnico                            | rodapé do radar                 |
| `equipment.availability` e `contracts.active_proxy` não variam por período | fora do radar, documentado      |
| Nada cria calendário no cadastro da organização                            | corrigido pela tela             |
| `EventQueryDto` não filtra por `type`                                      | calendário dedicado a lembretes |
| Janela do Scheduling limitada a 366 dias                                   | lembretes olham 12 meses        |
| Evento não tem `isActive`                                                  | ativação usa `status`           |
| Nenhuma automação reage à conclusão de operação                            | lembrete é criado por pessoa    |
| Sem endpoint de troca de responsável                                       | atribui e depois desatribui     |
| Operação não passa pelo motor de agenda                                    | declarado ao reagendar          |
| Autorização não é aplicada pelo backend                                    | aviso em destaque na aba        |
| `OperationQueryDto` não aceita ordenação                                   | (já registrado na PR anterior)  |

---

## 7. Verificação

```
backend  tsc -p tsconfig.build.json          sem erros
         jest src/modules/{dashboards,organizations}   7 suites · 22 testes

API real (organização registrada do zero, plano STARTER)
  GET  /organizations/current/members        200 · 1 membro · isOwner true
  GET  /dashboard                            radar order 5 MEDIUM antes da
                                             Central de Atenção order 10 LARGE
  GET  /analytics/kpis (2 janelas)           200 · 5 indicadores % por janela
  GET  /scheduling/calendars (org nova)      200 · 0  ← causa raiz do bug
  POST /scheduling/calendars                 201 · isDefault true
  POST /scheduling/events (recorrente 6m)    201 · MONTHLY interval 6
  GET  /scheduling/events?calendarId=…       200 · dedupe por eventId
  GET  /scheduling/events (25 meses)         400 · "cannot exceed 366 days"
  GET  /scheduling/events?type=…             400 · property type should not exist
  PATCH /scheduling/events/:id CANCELLED     200
  POST /operations                           201 · status SCHEDULED (backend)
  PATCH /operations/:id (reagendar)          200
  PATCH /operations/:id (prioridade)         200 · URGENT
  POST /operations/:id/assignments           201
  PATCH /operations/:id/status SCHEDULED     400 · transição recusada
  PATCH /operations/:id/status CANCELLED     200
  DELETE /operations/:id/assignments/:user   204
  PATCH /organizations/current (settings)    200 · lido de volta igual
  GET  /operations?requiresAuthorization     400 · propriedade não existe

frontend tsc --noEmit                        sem erros
         eslint .                            0 erros · 4 warnings pré-existentes
         next build                          ✓
         Design System (components/ui/**)    intacto
```

---

## 8. O que **não** foi feito

- nenhum indicador calculado no frontend;
- nenhum mock, nenhum dado estimado;
- nenhum componente do Design System criado ou alterado;
- nenhuma máquina de status reproduzida no cliente;
- nenhum componente duplicado — Visão geral e Calendário são o mesmo workspace;
- nenhuma configuração granular inventada na aba de Autorização.
