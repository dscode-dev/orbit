# PMOC & Compliance Engine (PR-26)

O que a empresa se comprometeu a manter, para quem, com que frequência — e o
que já venceu.

## O que mudou

Antes desta PR, "PMOC" no Orbit era **um tipo de documento**: o template oficial
`ORBIT_PMOC` e as execuções dele. Isso responde "este formulário foi
preenchido?". Não responde as perguntas que a operação faz todo mês:

- quais equipamentos estão cobertos por um plano?
- quando é a próxima manutenção de cada um?
- o que está vencido, e há quantos dias?

O indicador `pmoc.compliance` do Analytics era derivado de `reports` cujo
template tinha "PMOC" no nome — media PDFs, não manutenção. E o relatório
gerencial de PMOC declarava a ausência: *"não há fonte autoritativa para
vencido"*.

Agora há.

## O domínio

```
PmocPlan ──▶ PmocEquipmentCoverage ──▶ Asset
     │
     └─────▶ PmocExecution (ciclo) ──▶ Operation
                                  └──▶ ArtifactExecution (evidência)
                                  └──▶ SchedulingEvent (agenda)
```

**O plano existe independentemente do documento.** Ele vale, vence e é medido
sem que nenhum PDF tenha sido emitido. A execução de artefato é a *evidência*
de um ciclo cumprido, vinculada quando existe de verdade — nunca fabricada para
"ter documento".

A cobertura guarda **o vínculo**, não o equipamento: nome, modelo e série
continuam sendo do cadastro de ativos. Copiá-los criaria uma segunda verdade
que envelhece na primeira correção.

## Três estados, e não se confundem

| Estado | Do que fala | Quem decide |
| --- | --- | --- |
| **do plano** (`status`) | o compromisso está valendo? | quem administra |
| **de conformidade** | a manutenção está em dia? | o calendário |
| **do ciclo** (`PmocExecution.status`) | aquele ciclo foi cumprido? | quem executou |

Um plano `ACTIVE` pode estar `OVERDUE`. Um plano `SUSPENDED` não está em dia nem
atrasado — está fora de avaliação, e por isso a conformidade dele é
`NOT_APPLICABLE`. Chamá-lo de "em dia" faria um painel dizer que está tudo certo
quando ninguém está mantendo nada.

### Máquina de estados

```
DRAFT ──▶ ACTIVE ⇄ SUSPENDED
  │          │         │
  └──────────┴─────────┴──▶ CANCELLED   (terminal)

ACTIVE ──(vigência acabou, pelo servidor)──▶ EXPIRED ──▶ CANCELLED
```

`EXPIRED` **não é destino de ninguém**: não é decisão, é constatação de que
`endsOn` passou. Quem o atribui é o servidor, na leitura (como o Commercial
Engine faz com propostas vencidas). Uma transição manual permitiria declarar
encerrado um contrato que ainda vale.

`CANCELLED` é terminal: retomar é criar outro plano, e o histórico dos dois fica
legível.

## Periodicidade

`DAYS` · `WEEKS` · `MONTHS` · `YEARS`, quantidade + unidade. **Sem cron** — um
campo cron seria uma linguagem dentro do formulário, e um contrato de manutenção
diz "de seis em seis meses", não "toda primeira segunda-feira".

A rolagem acontece **em SQL**:

```sql
next_due_on = (performed_at::date + make_interval(
  years => …, months => …, weeks => …, days => …
))::date
```

Seis meses depois de 31 de agosto é 28 de fevereiro; `setMonth` em JavaScript
daria 3 de março, e num plano semestral que roda por anos o desvio acumula até
a manutenção "semestral" cair no mês errado.

A periodicidade é **do plano**, não por equipamento. Periodicidades diferentes
por ativo dentro do mesmo plano tornariam ambíguo o que é "a próxima manutenção
do plano" — quem precisa disso cria dois planos, e cada um fica legível sozinho.
Está declarado como evolução futura.

## Conformidade

```
dias = próximo vencimento − hoje          (hoje = relógio do servidor)

dias <  0                  → OVERDUE
dias <= dueSoonDays        → DUE_SOON
caso contrário             → UP_TO_DATE
plano não ativo            → NOT_APPLICABLE
```

Essa é **toda** a fórmula. Não há score: um número entre 0 e 100 esconde
exatamente o que importa — *qual* plano venceu e *há quantos dias*. Um painel
com "87% de conformidade" não diz a ninguém o que fazer amanhã de manhã.

A antecedência (`dueSoonDays`, 15 por padrão) é **do plano**: trinta dias fazem
sentido num plano anual e são ruído num semanal.

A comparação é **por dia**. Manutenção vence no dia; comparar por instante faria
o mesmo plano parecer vencido de manhã e em dia à tarde conforme o fuso de quem
consulta.

A mesma régua existe em dois lugares e é a mesma: `evaluateCompliance` (para o
Read Model) e o predicado SQL do filtro de listagem e do painel. Duas fórmulas
divergiriam no primeiro caso de borda, e a lista discordaria do painel logo
acima dela.

### O percentual publicado

`em dia ÷ (em dia + próximos + vencidos)`, sobre planos ativos, com uma casa.
`null` quando não há plano ativo — "100%" de nada afirmaria uma conformidade que
ninguém mantém.

## Próxima execução, sem depender de ninguém abrir tela

Duas coisas diferentes, e as duas resolvidas:

**O que se lê** é calculado na leitura, com o relógio do servidor. Nunca fica
velho, mesmo que ninguém abra nada.

**O que acontece** — o evento que dispara automação e notificação — vem de dois
jobs que o próprio plano enfileira quando ganha um vencimento:

```
plano ativado ──▶ available_at = vencimento − dueSoonDays  ──▶ pmoc.due_soon
              └─▶ available_at = vencimento + 1 dia        ──▶ pmoc.overdue
```

**Não é um cron.** Não há varredura periódica, tabela de agendamentos própria
nem relógio paralelo: são dois jobs na `BackgroundJobQueue` que já existe, com
`available_at` derivado do vencimento. Quando a manutenção é cumprida, o ciclo
seguinte enfileira os seus.

Um aviso por vencimento: `notify()` só emite se o plano ainda estiver ativo, no
mesmo vencimento, e o aviso daquele vencimento ainda não tiver saído — tudo num
`UPDATE` condicional sobre `due_soon_notified_for` / `overdue_notified_for`.
Sem isso, "vence em 15 dias" chegaria todo dia durante quinze dias.

## PMOC → Scheduling

Ativar o plano cria um `SchedulingEvent` do tipo `MAINTENANCE` com
`sourceModule = 'pmoc'`, na **Agenda existente**, apontando para o plano.

Não há recorrência paralela: a recorrência do PMOC **é o plano**. Cada ciclo
cria o evento do seu vencimento; o seguinte nasce quando este for cumprido. Uma
regra de recorrência no Scheduling duplicaria a periodicidade em dois lugares, e
elas divergiriam no primeiro atraso.

O evento nasce `TENTATIVE`: é uma previsão do sistema, não um compromisso que
alguém marcou.

## PMOC → Automation

Quatro gatilhos no catálogo do Automation Engine, todos com ponto autoritativo:

| Evento | Onde nasce |
| --- | --- |
| `pmoc.plan.activated` | transição do plano, na transação |
| `pmoc.due_soon` | job de vencimento, guardado por coluna |
| `pmoc.overdue` | idem |
| `pmoc.execution.completed` | conclusão do ciclo, na transação |

Os eventos saem **de dentro da transação do domínio** (outbox), como em
operações, orçamentos e estoque: ou o fato e o evento acontecem juntos, ou
nenhum.

Automação real, sem código novo: `pmoc.due_soon → SEND_NOTIFICATION`, ou
`pmoc.overdue → CREATE_REMINDER`.

## PMOC → Operation

`POST /pmoc/plans/:id/executions/:executionId/operation` cria a ordem de serviço
do ciclo, **reutilizando `Operation`** — não há entidade paralela de ordem de
serviço.

Idempotente: `pg_advisory_xact_lock` serializa chamadas concorrentes para o
mesmo ciclo, e a segunda encontra `operation_id` preenchido e devolve o que
existe. É a mesma defesa da conversão de orçamento. O código deriva do plano e
do vencimento (`OS-PMOC-2026-001-2026-07-01`), para a origem ser legível na
listagem de operações.

**Técnico e agendamento não são atribuídos.** São decisões de quem organiza o
dia; escolher por eles produziria uma ordem que ninguém combinou.

## PMOC → ArtifactExecution

A evidência é vinculada, nunca criada. A execução precisa existir, ser da mesma
unidade e ter `artifactType` de PMOC — vincular um checklist de instalação como
evidência de PMOC produziria um histórico que parece conforme e não é.

Um ciclo, uma evidência (índice único). Nenhum gerador de documentos novo: o
PDF continua sendo do Artifact Rendering Engine.

## Responsável técnico

`technicianUserId` é uma **referência operacional** a um membro ativo da
organização. O Orbit **não** guarda CREA, RRT ou ART, e inventá-los aqui daria
aparência de conformidade regulatória a um campo que ninguém verifica. Esses
dados existem no formulário do artefato PMOC (`registro_rt`, `art`), preenchidos
e assinados por quem responde por eles.

## API

| Método | Rota | Capability |
| --- | --- | --- |
| `GET` | `/pmoc/compliance` | `pmoc.read` |
| `GET` | `/pmoc/upcoming` | `pmoc.read` |
| `GET` | `/pmoc/plans` | `pmoc.read` |
| `POST` | `/pmoc/plans` | `pmoc.manage` |
| `GET` | `/pmoc/plans/:id` | `pmoc.read` |
| `PATCH` | `/pmoc/plans/:id` | `pmoc.manage` |
| `POST` | `/pmoc/plans/:id/activate` · `/suspend` · `/cancel` | `pmoc.manage` |
| `GET`/`POST` | `/pmoc/plans/:id/equipment` | `pmoc.read` / `pmoc.manage` |
| `DELETE` | `/pmoc/plans/:id/equipment/:coverageId` | `pmoc.manage` |
| `GET` | `/pmoc/plans/:id/executions` | `pmoc.read` |
| `POST` | `…/executions/:id/complete` | `pmoc.manage` |
| `POST` | `…/executions/:id/operation` | `pmoc.manage` **+** `operations.*` |
| `POST` | `…/executions/:id/evidence` | `pmoc.manage` **+** `artifact_executions.read` |

Filtros da listagem: `search`, `status`, `compliance`, `businessUnitId`,
`customerId`, `assetId`, `dueUntil`, `page`, `limit`. O filtro de conformidade é
resolvido no banco — filtrá-lo em memória devolveria a página errada.

Cada transição tem rota própria: um `PATCH { status }` genérico permitiria
escrever `EXPIRED` à mão.

## Segurança

- **RLS por organização e por unidade** em `pmoc_plans` (todo plano pertence a
  uma unidade — não existe plano "da organização inteira", porque quem executa a
  manutenção é uma equipe de uma filial). Cobertura e ciclos herdam o recorte
  pela organização e pelo plano.
- **Capabilities próprias.** Acesso a equipamento **não** dá acesso a PMOC: o
  plano diz o que a empresa se comprometeu a manter e para quem, e isso é
  informação contratual.
- **E elas não substituem as dos outros domínios.** Gerar a ordem exige
  `operations.create`; vincular evidência exige `artifact_executions.read`. Um
  módulo que integra outros é exatamente onde as autorizações se perdem, se cada
  uma não for conferida no seu lugar.
- **O relatório gerencial não é contorno**: `PMOC_COMPLIANCE` passou a exigir
  `pmoc.read` além da capability de relatórios.
- Auditoria em criação, transições, cobertura e conclusão de ciclo.

## Integridade

Garantida no banco, não por checagem prévia:

- equipamento do mesmo tenant **e** da mesma unidade do plano (serviço + RLS);
- cobertura duplicada recusada por índice único parcial;
- um ciclo por vencimento (`(plan_id, due_on)` único enquanto não cancelado);
- uma ordem por ciclo, uma evidência por ciclo, um evento de agenda por ciclo
  (índices únicos);
- vigência ordenada, periodicidade positiva e antecedência entre 1 e 365
  (`CHECK`);
- ciclo concluído tem data de execução (`CHECK`) — sem ela, a rolagem partiria
  do nada.

## Analytics e Management Reports

`GET /pmoc/compliance` publica planos por situação, conformidade, equipamentos
cobertos e ciclos (concluídos no período, em aberto, vencidos).

O KPI `pmoc.compliance` do Analytics **passou a ler o domínio**: a fonte mudou
de `reports + report_templates` para `pmoc_executions`, com o mesmo formato — os
motores de KPI e de tendência não mudaram.

O provider `PMOC & Compliance` do Management Reports agora compõe planos,
conformidade e ciclos a partir do `PmocService` — a mesma fonte que a API usa,
com a mesma régua — e mantém a contagem de execuções de artefato como o que ela
sempre foi: a evidência documental, ao lado do fato operacional. **A seção que
declarava "não existe PMOC vencido" foi removida** porque a fonte passou a
existir.

Relatórios gerados antes disso continuam idênticos: o snapshot é imutável, e
nenhuma leitura o recompõe — provado no E2E.

## Limitações regulatórias e lacunas declaradas

- **Nenhuma interpretação jurídica.** O Orbit não conhece a Lei 13.589, não
  deduz periodicidade legal por tipo de equipamento e não emite parecer. A
  periodicidade é a **contratada**; o sistema a cumpre, mede e registra — não a
  prescreve.
- **Sem ART/RRT, CREA ou registro profissional** no domínio — ver "responsável
  técnico".
- **Sem integração com órgão público** e sem assinatura digital regulatória.
- **Sem periodicidade por equipamento** — ver "periodicidade".
- **Sem plano-modelo por segmento**: cada plano é escrito por quem o contratou.
- **Sem cobrança, estoque específico de PMOC, IoT ou manutenção preditiva.**
- **Sem cancelamento de ciclo pela API**: um ciclo pendente vive até ser
  cumprido ou até o plano ser suspenso/cancelado. A coluna aceita `CANCELLED`
  para quando o fluxo existir.
- **A vigência expira na leitura**, não por varredura: um plano vencido que
  ninguém consultou continua `ACTIVE` na tabela até a primeira leitura da
  organização. Nenhuma resposta da API mostra o estado velho.

## Testes

- `pmoc.domain.spec.ts` — 15 casos: máquina de estados (inclusive `EXPIRED` não
  ser destino de ninguém e `CANCELLED` ser terminal), os três estados de
  conformidade, o limite inclusivo da antecedência, "vence hoje ainda não
  venceu", plano fora de avaliação e independência da hora do dia.
- `test/pmoc.e2e-spec.ts` — 18 blocos cobrindo os 25 cenários: criação,
  ativação com primeiro vencimento e evento de agenda, suspensão e cancelamento
  terminal, vigência inválida, cobertura aceita/duplicada/de outra unidade/de
  outro tenant, **seis meses de calendário conferidos contra o Postgres**,
  `UP_TO_DATE`/`DUE_SOON`/`OVERDUE` pelo relógio do servidor, filtro por
  unidade, **ordem de serviço idempotente sob corrida**, evidência de PMOC
  aceita e checklist recusado, os quatro eventos no catálogo com emissão única,
  automação reagindo a `pmoc.overdue`, painel de conformidade, relatório
  gerencial usando a fonte real sem a antiga lacuna, 403 para quem tem
  equipamentos mas não PMOC, 403 no relatório sem `pmoc.read`, isolamento entre
  organizações, políticas de RLS e **snapshot gerencial antigo imutável**.
