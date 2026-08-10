# Automation Engine (PR-24)

Quando algo acontece no domínio, alguma coisa combinada acontece depois.

## A forma

```
fato de domínio ──▶ DomainEvent ──▶ automation.dispatch ──▶ regras da organização
                                          │
                                          ▼  condições avaliadas
                                  AutomationExecution
                                          │
                       automation.action (com prazo) ──▶ lembrete · notificação · job
```

Uma regra é um formulário preenchido: **gatilho → condições → ações**. Não é um
script, não é uma expressão, não é um fluxo com desvios. O motor só sabe
executar o que já sabia executar antes de a regra existir — e isso é a
funcionalidade, não a limitação. A superfície de automação de um ERP
multi-tenant é exatamente a superfície de ataque dele.

## Por que dois passos na fila

O despacho é rápido e sem efeito externo: lê regras, avalia condições, registra
o que deve acontecer. A execução é lenta, pode falhar e pode ser **futura** —
seis meses futura. Separar as duas permite que a ação adiada seja um job
dormindo na fila, e que a falha de uma ação não obrigue a reavaliar as regras.

## O evento

```jsonc
{
  "id": "uuid-v7",
  "type": "operation.completed",
  "occurredAt": "2026-08-10T14:02:11.000Z",
  "organizationId": "…",
  "businessUnitId": "…",
  "actorId": "…",
  "entityType": "OPERATION",
  "entityId": "…",
  "payloadVersion": 1,
  "payload": { "kind": "MAINTENANCE", "priority": "NORMAL", "…": "…" },
  "correlationId": "…"
}
```

O `payload` guarda **apenas escalares** — o emissor descarta objeto e array.
Serializar a entidade Prisma inteira transformaria o evento num retrato do
schema: qualquer coluna nova viraria contrato público retroativo, e qualquer
coluna sensível vazaria para uma tabela que ninguém trata como sensível.

`payloadVersion` existe desde o primeiro evento. Um consumidor que só entende a
versão 1 precisa poder dizer isso; começar sem versão e adicioná-la depois
significa que os eventos antigos não têm resposta.

O evento nasce **dentro da transação do domínio**, junto com o job de despacho
(padrão outbox). Não há janela em que a operação exista e o evento não: ou os
dois acontecem, ou nenhum.

### Pontos autoritativos

Nenhum evento foi inventado. Cada um sai do lugar onde o fato realmente
acontece:

| Evento | Onde nasce |
| --- | --- |
| `operation.created` | `operation.repository.create()` |
| `operation.status.changed` | `operation.repository.changeStatus()` |
| `operation.completed` | idem, quando o destino é `COMPLETED` |
| `artifact.execution.completed` | `artifact-execution.repository`, ao concluir |
| `artifact.manifest.issued` | `artifact-manifest.repository`, na emissão |
| `quote.approved` | `quote.repository.transition()`, destino `APPROVED` |
| `inventory.low_stock` | `inventory.repository`, após saída que cruzou o mínimo |

`operation.completed` é publicado à parte de `status.changed` de propósito.
"Quando concluir" é a regra que a operação de campo mais escreve, e obrigá-la a
lembrar da condição `status = COMPLETED` num gatilho genérico convidaria ao erro
de esquecê-la — e a regra dispararia em toda pausa.

## Condições

Quatro operadores sobre campos escalares de um payload plano:

| Operador | O que faz |
| --- | --- |
| `equals` | compara texto |
| `notEquals` | compara texto; **campo ausente não satisfaz** |
| `in` | pertinência a uma lista fechada |
| `exists` | o campo veio preenchido |

**Todas as condições precisam ser verdadeiras.** Não há `OR` nem agrupamento:
quem precisa de duas alternativas cria duas regras, e cada uma fica legível
sozinha. Um editor de expressão booleana seria o começo do BPMN que esta PR
existe para não construir.

Não há `contains` nem comparação numérica — os dois convidam à expressão, e
expressão é o começo de linguagem.

O campo precisa estar na lista `fields` do gatilho, conferida **na criação da
regra**. Um campo fora dela nunca seria satisfeito, e uma regra que nunca
dispara é pior que uma recusada: ela parece configurada.

## Ações

| Ação | Estado | O que faz |
| --- | --- | --- |
| `CREATE_REMINDER` | disponível | evento no calendário padrão da unidade |
| `SEND_NOTIFICATION` | disponível | notificação para `OWNER`, `ACTOR` ou `USER` |
| `TRIGGER_JOB` | disponível | enfileira um trabalho **da lista fechada** |
| `CREATE_FOLLOW_UP_OPERATION` | **indisponível** | ver abaixo |

`CREATE_FOLLOW_UP_OPERATION` está declarada e **desligada**. `Operation` exige
código único por organização, e não existe contrato que o derive
automaticamente. Gerar uma sequência aqui criaria uma segunda regra de numeração
competindo com a que a equipe usa na mão. Quando a regra a inclui, a execução é
registrada como `SKIPPED` com o motivo — a interface mostra que tentou e por que
não seguiu, em vez de silenciar e parecer que funcionou.

`TRIGGER_JOB` aceita apenas `artifact.render`. Sem URL, sem webhook, sem
requisição HTTP — por decisão explícita desta PR. A fila é conferida duas vezes:
na criação da regra e de novo na execução. Sem a lista fechada, uma regra
poderia enfileirar em `automation.action` e criar um laço.

O destinatário de uma notificação é sempre um **usuário da organização**,
resolvido no momento da execução e conferido contra as associações ativas. Não
há e-mail livre nem destino externo.

## Prazos

`MINUTES` · `HOURS` · `DAYS` · `WEEKS` · `MONTHS`, calculados no **Postgres**:

```sql
SELECT now() + make_interval(months => $1, weeks => $2, days => $3,
                             hours => $4, mins => $5)
```

Meses e semanas têm semântica de **calendário**. Um mês depois de 31 de janeiro
é 28 de fevereiro, não 2 de março — `setMonth` em JavaScript daria o segundo.
Aproximar mês como trinta dias faria um lembrete semestral escorregar cinco dias
por ano, e em três anos a preventiva anual cairia num mês diferente do
contratado.

O prazo vira `available_at` no job. O adiamento é da fila, não de um agendador
próprio: `claim()` já usava `available_at <= now()` com `FOR UPDATE SKIP
LOCKED`. Um segundo mecanismo de tempo seria um segundo lugar para o relógio
errar.

O lembrete criado **começa quando a ação executa** — o atraso já aconteceu na
fila. Marcá-lo para dali a mais seis meses contaria o prazo duas vezes.

## Idempotência

A identidade de uma execução é `(eventId, ruleId, actionId)`, e é **única no
banco**:

```sql
INSERT INTO automation_executions (…)
VALUES (…)
ON CONFLICT (event_id, rule_id, action_id) DO NOTHING
RETURNING id
```

Sem linha devolvida, o despacho não enfileira a ação: já havia sido agendada.

Na execução, o processador **reivindica antes de agir**:

```sql
UPDATE automation_executions
   SET status = 'RUNNING', attempts = attempts + 1, updated_at = now()
 WHERE event_id = $1 AND rule_id = $2 AND action_id = $3
   AND status <> 'SUCCEEDED'
RETURNING id, attempts
```

Nenhuma linha ⇒ a ação já deu certo ⇒ o processador desiste. Retry da fila, job
devolvido por tempo limite e reprocessamento manual convergem para um efeito.
Falha e pendência continuam retomáveis, que é o que uma fila com retry precisa.

O `id` de cada ação (`a1`, `a2`, …) é atribuído pelo servidor e **preservado na
edição**: trocar o texto de um lembrete não faz uma ação já executada parecer
nova.

> Uma consequência a conhecer: reenfileirar o **despacho** de um evento antigo o
> avalia contra as regras de **hoje**. É o comportamento correto — o despacho não
> congela o conjunto de regras —, mas significa que replay em massa da fila pode
> produzir ações que não existiam na época. Retry normal não faz isso: o job de
> despacho é por evento e a idempotência cobre o par regra/ação.

## Tenant, RLS e o worker

O worker reabre o `RequestContext` do tenant a partir do job — organização,
unidade e ator —, como no Rendering Engine. Nenhuma consulta do motor roda como
administrador da plataforma: a RLS é a mesma de uma requisição.

Tudo o que a ação escreve passa por essa RLS: o lembrete pelo `WITH CHECK` de
`scheduling_events`, a notificação pelo de `notifications`. Uma regra apontando
para unidade de outra organização não escreveria nada — o banco recusa antes de
o serviço perceber.

`domain_events`, `automation_rules` e `automation_executions` têm política por
organização e `FORCE ROW LEVEL SECURITY`. Regra com `businessUnitId` nulo vale
para a organização inteira; com unidade preenchida, só casa com eventos daquela
unidade.

> **Nota de ambiente:** na instalação de desenvolvimento o papel da aplicação é
> superusuário e **contorna RLS**. O E2E prova o isolamento pela API — que é
> como o usuário chega ao dado — e confere a existência das políticas pelo
> catálogo do Postgres. Um teste que lesse a tabela direto passaria pelo motivo
> errado.

## Falha

Erro fecha a execução como `FAILED` e **relança**: a fila decide entre repetir e
enterrar. `PermanentJobError` — destinatário inexistente, fila não permitida,
organização sem calendário — vai direto para `DEAD`, porque repetir não mudaria
o resultado. O efeito nunca fica pela metade: a ação verifica antes de agir, e a
linha de execução não está `SUCCEEDED`, então retomar é permitido e não duplica.

Desligar uma regra **não cancela** o que já está agendado. A ação pendente
confere `enabled` na hora de executar e termina como `SKIPPED` com o motivo.
Varrer a fila para cancelar dá o mesmo resultado com uma consulta a mais.

Excluir uma regra com ação **agendada e não executada** é recusado com **409**.
Apagá-la deixaria um job órfão que, ao acordar, não a encontraria e seria
descartado em silêncio: o usuário teria excluído a automação achando que a
cancelou, e ela ainda estaria pendente por meses. Quem quer parar agora
**desliga**.

## Observabilidade

`correlationId` nasce no evento e atravessa despacho, execução, job, lembrete e
notificação. Os logs são estruturados: `rule-skipped` (com a condição que
barrou), `dispatched` (regras avaliadas, ações agendadas), `action-executed`
(tipo, tentativa, resultado, duração), `action-failed`, `action-already-done`.

`GET /automations/executions` devolve o mesmo histórico pela API, com `attempts`,
`scheduledFor`, `executedAt`, `result` e `detail`.

## Contratos

`automation.read-models.ts` entra na lista de Read Models sincronizados
(`frontend/scripts/sync-contracts.mjs`) e é **TypeScript puro**: os conjuntos
fechados — operador, tipo de ação, unidade de prazo, alvo de notificação,
situação de execução — moram em `contracts/literals`, não no catálogo do
módulo. Um Read Model que importasse do catálogo arrastaria código de servidor
para dentro do build do frontend, que roda num contexto Docker onde o diretório
do backend nem existe.

Esses cinco conjuntos usam `as const` em vez do ajudante `literal()`: o ajudante
alarga o tipo para `string`, e aqui o catálogo, o interpretador e os
processadores decidem por comparação — `'CREATE_REMINDR'` digitado errado
precisa quebrar a compilação.

O catálogo de gatilhos, com rótulos e campos, **não** é contrato estático: vem
de `GET /automations/catalog`. Uma lista escrita no cliente divergiria no
primeiro evento novo e ofereceria automações que o motor não sabe disparar.

## Endpoints

| Método | Rota | Capability / Permissão |
| --- | --- | --- |
| `GET` | `/automations/catalog` | `automations.read` |
| `GET` | `/automations` | `automations.read` |
| `GET` | `/automations/executions` | `automations.read` |
| `GET` | `/automations/:id` | `automations.read` |
| `POST` | `/automations` | `automations.manage` |
| `PATCH` | `/automations/:id` | `automations.manage` |
| `POST` | `/automations/:id/toggle` | `automations.manage` |
| `POST` | `/automations/:id/duplicate` | `automations.manage` |
| `DELETE` | `/automations/:id` | `automations.manage` |

Filtros de `/automations`: `search`, `trigger`, `businessUnitId`, `enabled`,
`page`, `limit`. De `/executions`: `ruleId`, `status`, `page`, `limit`.
Paginação sempre no banco.

A regra **nasce ligada**. Criar desligada e esquecer de ligar é o modo mais
comum de uma automação não funcionar sem ninguém notar. A cópia, ao contrário,
nasce desligada: ela existe para ser ajustada antes de valer.

`trigger` não muda na edição — trocá-lo transformaria a regra em outra, com o
histórico de execuções da anterior pendurado nela. Quem errou o gatilho duplica
e ajusta.

## O backlog que esta PR fecha

Do Scheduling: **operação concluída → lembrete futuro**, sem depender de alguém
abrir a Agenda.

```jsonc
{
  "name": "Preventiva semestral",
  "trigger": "operation.completed",
  "conditions": [{ "field": "kind", "operator": "equals", "value": "MAINTENANCE" }],
  "actions": [
    {
      "type": "CREATE_REMINDER",
      "delay": { "amount": 6, "unit": "MONTHS" },
      "config": { "title": "Retorno da preventiva" }
    }
  ]
}
```

O E2E percorre o caminho inteiro: a operação conclui, a execução fica `PENDING`
com `scheduledFor` a seis meses de calendário, o job dorme, e quando o prazo
chega **o worker** cria o lembrete — apontando para a operação de origem, no
calendário e na unidade certos.

> **Sobre "PREVENTIVE":** o contrato de `Operation` não tem esse `kind`. Os
> valores autoritativos são `INSTALLATION`, `MAINTENANCE`, `INSPECTION`,
> `DELIVERY` e `OTHER`. A regra acima usa `MAINTENANCE`, que é o que o domínio
> de fato registra. Inventar um valor no catálogo de automação criaria uma
> condição que nunca casaria com evento nenhum.

### PMOC — preparado, não duplicado

O que o PMOC exige e já existe: gatilho na conclusão, condição por tipo e
unidade, ação com prazo de **calendário** e lembrete no calendário certo.

O que **não** foi feito aqui: repetição. Uma regra dispara uma vez por
ocorrência de evento; ela não gera série. O motor de recorrência é do Scheduling
(`recurrence.engine.ts`), e uma segunda implementação de RRULE dentro das
automações significaria duas verdades sobre "toda terça, exceto feriado". O
caminho é a ação criar um evento **recorrente** do Scheduling — uma ação a mais
neste catálogo, não um agendador novo.

## Lacunas declaradas

- **Sem BPMN, editor visual, laços e ramificação.**
- **Sem JavaScript, SQL, template executável ou linguagem de expressão.**
- **Sem webhook, URL arbitrária ou requisição HTTP externa.**
- **Sem aprovação humana no meio do fluxo.**
- **Sem IA decidindo regra** — a regra é escrita por gente.
- **Sem automação entre tenants.**
- **Sem `CREATE_FOLLOW_UP_OPERATION`** — declarada indisponível, com motivo.
- **Sem recorrência própria** — ver PMOC, acima.
- **Sem agendamento em data absoluta** ("todo dia 5"): o prazo é sempre relativo
  ao evento. Data absoluta é agenda, não automação.
- **Sem cancelamento de ação agendada individualmente**: desliga-se a regra, e a
  ação pendente termina como `SKIPPED`.
- **Sem limite de disparos por regra ou por período.** Uma regra que casa com
  muitos eventos agenda muitas ações; a fila absorve, mas não há teto declarado.

## Testes

- `automation.evaluator.spec.ts` — 9 casos do interpretador de condições,
  incluindo campo ausente sob `notEquals` e valor não escalar tratado como
  ausente.
- `automation.service.spec.ts` — 14 casos de validação de regra: gatilho fora do
  catálogo, campo fora do gatilho, forma do valor por operador, configuração
  obrigatória por ação, destinatário membro da organização, fila permitida, id
  estável de ação, cópia desligada, exclusão recusada com pendência.
- `test/automations.e2e-spec.ts` — 16 casos contra a aplicação montada: catálogo
  publicado pelo servidor; gatilho, campo e fila recusados; regra ligada
  executando e registrando resultado; regra desligada sem execução; condição que
  casa e que não casa; **manutenção concluída agendando lembrete para seis meses
  de calendário e o worker criando-o quando o prazo chega**; despacho e ação
  reprocessados sem duplicar efeito nem tentativa; regra desligada depois do
  agendamento terminando em `SKIPPED`; exclusão com pendência recusada com 409;
  isolamento entre organizações e entre unidades; 403 sem permissão e 401 sem
  token; evento versionado com payload só de escalares; falha permanente indo
  para `DEAD` sem efeito parcial; duplicação desligada e exclusão limpa; filtros
  e paginação; políticas de RLS presentes nas três tabelas.
