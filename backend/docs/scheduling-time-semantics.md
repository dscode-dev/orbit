# Scheduling Time Semantics

## Regra

O Scheduling armazena instantes (`TIMESTAMPTZ`) em UTC e interpreta conceitos
de calendário no timezone IANA autoritativo. Um `DATE` é um dia civil e nunca é
convertido como se fosse um instante.

O timezone do browser e o header `x-timezone` não decidem regras operacionais.
Eles continuam disponíveis apenas como contexto de cliente/observabilidade.

## Autoridade

Para uma Agenda:

1. quando há `businessUnitId`, vale o timezone da Business Unit;
2. sem unidade, vale o calendário default global da organização;
3. para dados legados sem ambos, o fallback explícito é `America/Recife`.

Para recorrência e disponibilidade, vale o timezone persistido na própria
regra/evento. Para eventos novos, DTOs já exigem timezone IANA e o runtime o
valida novamente ao executar aritmética civil. Registros legados recebem o
default persistido `America/Recife`; nunca o timezone da máquina.

## Conversões corrigidas

Foram corrigidos oito pontos da mesma classe:

1. agrupamento de ocorrências por dia na Agenda;
2. limites de dia, semana e mês em `viewRange`;
3. dia da semana de availability;
4. comparação de exceções `DATE` de availability;
5. minutos locais das janelas de availability;
6. recorrências diária, semanal e mensal;
7. janela e bucket de hoje do Scheduling Dashboard;
8. materialização de `PmocPlan.nextDueOn` no evento da Agenda.

O range local é transformado em `[início local, início do próximo período
local)`. Os dois limites viram instantes UTC antes da consulta. Assim a query
continua usando comparações diretas `starts_at < to` e `ends_at > from`, sem
envolver a coluna em `AT TIME ZONE` e sem carregar todos os eventos do tenant.
Dias de DST podem naturalmente ter 23 ou 25 horas.

Availability calcula weekday e minutos com `Intl.DateTimeFormat` no timezone da
regra. Uma exceção persistida em `DATE` é comparada pela chave civil
`YYYY-MM-DD`; o ISO de meia-noite UTC é usado somente para preservar o valor do
tipo DATE materializado pelo Prisma. A busca SQL usa uma margem indexável de um
dia para regras com fusos distintos, e a comparação civil exata elimina os
candidatos excedentes.

## Recorrência

Recorrências diária, semanal e mensal avançam componentes civis, não blocos de
24 horas. Portanto “segunda às 09:00” permanece 09:00 após uma mudança de
offset. A duração do evento continua absoluta. Datas customizadas permanecem
instantes explícitos, como no contrato anterior. Nenhum novo recurrence engine
foi introduzido.

## Integrações

`nextDueOn` de PMOC é `DATE`. O evento é criado às 12:00 civis no timezone do
calendário e a Agenda agrupa no mesmo dia de vencimento. Compliance continua no
PMOC.

`CREATE_REMINDER` continua recebendo da Automation Engine o instante já
calculado. Scheduling persiste esse instante e o timezone do calendário sem
recalcular delays em dias, semanas ou meses. Os testes E2E de Automation
continuam cobrindo criação e execução do reminder.

Management Reports não foi alterado: seu uso existente de `AT TIME ZONE` já é
correto e snapshots permanecem imutáveis.

Analytics foi inspecionado. `TrendEngine` ainda usa buckets UTC, mas seu
contrato atual não recebe timezone operacional nem afirma representar dia civil
de uma unidade; alterar isso nesta PR criaria uma nova semântica sem autoridade
definida. Portanto não foi classificado como o mesmo bug. Quando Analytics
publicar buckets civis, o timezone deverá integrar explicitamente o contrato.

## Compatibilidade e performance

Endpoints e shapes públicos permanecem iguais. `range.timezone`, que já era
`string`, agora contém o timezone realmente usado em vez do literal incorreto
`UTC`. Web e Flutter permanecem compatíveis. `/scheduling/agenda` pode voltar a
ser consumido com segurança; a remoção do workaround Web em
`/scheduling/events` fica para uma PR de frontend.

Não há migration. A consulta principal continua limitada pelo range UTC e
compatível com os índices de `starts_at`; apenas uma leitura pequena de timezone
é acrescentada. Nenhuma coluna temporal é envolvida em função no predicado de
eventos e nenhum endpoint `/agenda-v2` foi criado.

## Cobertura

- `America/Recife`: 22:30, antes/depois da meia-noite, dia/mês, agrupamento,
  domingo que já é segunda em UTC e exceção por data;
- `America/New_York`: dia de 23 horas e recorrência mantendo 09:00 civil;
- independência de `process.env.TZ`, comparando hosts Honolulu e Berlim;
- PMOC → Agenda: `nextDueOn`, grupo civil e evento vinculado concordam;
- Automation → Reminder: suíte E2E preservada.
