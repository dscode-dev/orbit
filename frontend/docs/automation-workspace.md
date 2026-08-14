# Automation Workspace (PR Frontend-22)

Onde se combina o que o Orbit faz sozinho.

## Onde mora

**Configurações → Automações.** Não há item na navegação principal, e a
ausência é a decisão: automação é governança — alguém decide uma vez que toda
manutenção concluída gera lembrete em seis meses, e depois ninguém volta. Um
item fixo na lateral disputaria espaço com o que se abre todo dia (operações,
agenda, orçamentos) para uma tela visitada uma vez por trimestre.

A rota é a que já existia (`/configuracoes`), com o guard de permissão que ela
já tinha. Nenhum `matcher` novo em `proxy.ts`, nenhuma rota nova em `ROUTES`.

## Uma regra é uma frase

```
Quando   Operação for concluída
Se       Tipo é igual a Manutenção
Então    Criar lembrete na agenda, em 6 meses
```

É como a regra aparece na listagem, no detalhe e — enquanto está sendo escrita
— no próprio editor, atualizada a cada escolha.

**Não há canvas, nó, seta ou fluxograma.** Uma regra do Orbit não ramifica, não
repete e não espera aprovação; desenhá-la como fluxo prometeria as três coisas.
Três linhas de texto dizem tudo o que existe, e o que não existe fica
visivelmente ausente.

## O catálogo é a autoridade

`GET /automations/catalog` publica gatilhos, ações, operadores, unidades de
prazo e — quando o campo de configuração tem conjunto fechado — os valores
aceitos. **Nenhuma dessas listas está escrita no cliente.** Sem o catálogo o
editor não abre, e é o comportamento certo: um formulário montado com uma lista
adivinhada ofereceria automações que o motor não sabe disparar.

Os conjuntos que já eram contrato sincronizado — operador, tipo de ação,
unidade de prazo, alvo de notificação, situação de execução — vêm de
`contracts/literals`. O que o cliente acrescenta são **rótulos**, e valor sem
rótulo aparece cru: um operador novo do backend precisa aparecer, não sumir.

### De onde vêm os valores de uma condição

O backend publica **quais campos** cada gatilho oferece, não os valores
possíveis de cada um — e não deveria: `kind` de operação é literal do domínio de
operações, que já é contrato. `automation-fields.ts` faz essa ponte, e é a única
coisa que ele faz:

| Campo | Origem |
| --- | --- |
| `kind`, `status`, `fromStatus`, `priority` (operações) | `OperationKind`, `OperationStatus`, `OperationPriority` |
| `status`, `kind` (estoque) | `InventoryStockStatus`, `ProductKind` |
| `businessUnitId` | unidades **da sessão** |
| `customerId`, `assetId`, `operationId`, `catalogItemId`, `artifactType`, `templateKey`, `total`, `currency` | texto livre, com dica do que se espera |

O mesmo nome significa coisas diferentes em gatilhos diferentes — `status` de
operação é `IN_PROGRESS`, `status` de saldo é `OUT_OF_STOCK` —, então a
resolução recebe o `entityType` do gatilho, não só o campo.

**`PREVENTIVE` não aparece em lugar nenhum**, porque não existe no domínio: os
tipos de operação são `INSTALLATION`, `MAINTENANCE`, `INSPECTION`, `DELIVERY` e
`OTHER`. A regra de preventiva condiciona por `MAINTENANCE`.

## O prazo

Valor e unidade, exatamente como o contrato espera:
`{ amount: 6, unit: "MONTHS" }`.

**Nunca convertido no navegador.** Seis meses de calendário depois de 31 de
agosto é 28 de fevereiro, e o `Date` do JavaScript não sabe disso — o Postgres
sabe, e é ele quem soma. A tela mostra a data que o servidor gravou ao agendar,
nunca uma que ela mesma calculou.

As unidades vêm de `catalog.delayUnits`: se o backend ganhar `YEARS`, ela
aparece sem ninguém editar o formulário.

## O lembrete de retorno

O caso real está explicado na própria tela, e não por enfeite: um prazo de seis
meses é a única coisa ali cujo efeito ninguém consegue verificar clicando. O
texto diz onde o lembrete vai aparecer (na **Agenda**, no calendário da unidade,
apontando para a operação de origem), quando, e que **ninguém precisa abrir
nada** para que aconteça.

Diz também o que acontece antes da hora: a ação fica **Agendada** no histórico
da regra, e desativar a regra a descarta — ela não vira lembrete.

## Escrita sem antecipação

Nenhum optimistic update. Toda escrita pode ser recusada por regra do servidor:
gatilho fora do catálogo, campo que o gatilho não oferece, chave de
configuração desconhecida, destinatário que não é membro, fila não permitida,
exclusão com ação agendada (**409**).

O interruptor de ligar/desligar é o caso mais tentador e o mais perigoso: ele
decide **se a regra vale**. Um `Switch` que vira na hora e volta sozinho quando
a requisição falha mente sobre a automação que está valendo — e é o tipo de
mentira que só se descobre quando o lembrete não chega.

`onError` invalida as leituras junto com `onSuccess`: 409 e 404 aqui significam
que a tela está velha — a regra ganhou pendência, foi desligada ou removida por
outra pessoa. Insistir no que está na tela faria a recusa parecer inexplicável.

## O histórico

`GET /automations/executions?ruleId=` publica cada ação agendada com `status`,
`attempts`, `scheduledFor`, `executedAt`, `detail` e o registro criado. **Nada é
inferido da configuração**: a data prevista é a que o servidor gravou.

O que o contrato **não** publica é o estado do job — nova tentativa em
andamento, backoff, descarte definitivo. `attempts` conta as tentativas e
`FAILED` diz que a última não deu certo, e é até onde a leitura honesta vai. A
tela declara essa fronteira em vez de desenhar um "reprocessando" que ninguém
confirmou.

## Autorização

`automations.read` abre a área; `automations.manage` permite criar, editar,
ligar, duplicar e excluir. Quem só lê vê as regras que valem na organização —
o que é útil e é o que o backend permite —, sem os botões que ele recusaria.
Sem `automations.read`, a aba explica a ausência em vez de mostrar erro.

O seletor de unidade oferece **apenas as unidades da sessão**, o mesmo recorte
que o token carrega: uma regra nunca pode ser criada apontando para fora do
contexto autorizado — e o servidor recusa de qualquer forma, com 404.

## Registries

- **Entity Registry**: `automation-rule`, com `basePath` nas Configurações e
  **sem `href`** — não há tela por registro, o detalhe abre em diálogo. `badges`
  vazio: `enabled` é interruptor, não conjunto de status, e inventar
  `{ true: "Ativa" }` faria um conjunto onde há um booleano.
- **Action Registry**: `create`, `update`, `enable`, `disable`, `duplicate` e
  `delete`, com a confirmação da exclusão declarada — inclusive o aviso de que o
  servidor pode recusá-la.
- **Nenhum "Automation Registry"** foi criado. Gatilhos e ações vêm da API;
  um registry local seria uma segunda cópia do catálogo, divergente no primeiro
  gatilho novo.

## Contratos usados

| Endpoint | Onde |
| --- | --- |
| `GET /automations/catalog` | monta o editor e traduz a frase |
| `GET /automations` | listagem, com `search`, `trigger`, `businessUnitId`, `enabled`, `page`, `limit` |
| `GET /automations/executions` | histórico por regra |
| `POST /automations` | criação |
| `PATCH /automations/:id` | edição (sem `trigger`) |
| `POST /automations/:id/toggle` | ligar e desligar |
| `POST /automations/:id/duplicate` | cópia desativada |
| `DELETE /automations/:id` | exclusão, recusada com 409 quando há pendência |
| `GET /organizations/current/members` | destinatário de notificação |
| `GET /scheduling/events` | onde o lembrete criado aparece |

`automations` foi acrescentado à allowlist do BFF
(`src/server/bff/allowlist.ts`) — verificado: `/api/orbit/automations/catalog`
responde 401 sem sessão, enquanto uma raiz não exposta responde 404.

## Integração com Scheduling e Notifications

Nenhuma das duas foi tocada. A automação **cria** um `SchedulingEvent` do tipo
`REMINDER` e uma `Notification` do tipo `AUTOMATION`, e os dois aparecem onde
sempre apareceram — Agenda e Central de Notificações. A aba de Automações
mostra o que foi criado e leva para lá; não desenha uma agenda própria nem uma
caixa de mensagens paralela.

## O que foi alterado no backend, e por quê

Duas mudanças mínimas, ambas aditivas:

1. **`options` nos campos de configuração do catálogo.** O catálogo publicava a
   descrição em prosa ("Uma de: artifact.render"), o que não serve para montar
   um seletor. Sem a lista estruturada, o cliente pediria que alguém
   **digitasse** o nome interno de uma fila, ou manteria uma lista própria que
   divergiria no primeiro valor novo — as duas coisas que a PR proíbe.
   `ActionDefinition.config[].options` foi acrescentado e preenchido para
   `SEND_NOTIFICATION.target` e `TRIGGER_JOB.queue`.

2. **Chave de configuração desconhecida é recusada.** O DTO já dizia que
   "cada tipo valida o que aceita no serviço", mas o serviço só conferia os
   campos **obrigatórios**. `titulo` no lugar de `title` era gravado em silêncio
   e a ação executava com o texto padrão — parece configurada e faz outra coisa.
   Agora é 400, com a lista das chaves aceitas.

O `AutomationCatalogReadModel` também teve `actions[].type`, `operators` e
`delayUnits` estreitados de `string` para os literais que já eram contrato — o
catálogo publica exatamente esses conjuntos, e o tipo largo obrigava o cliente a
converter.

## Lacunas declaradas

Aparecem **na tela**, no painel "O que uma automação faz — e o que não faz",
porque a palavra "automação" carrega expectativa de ferramenta de fluxo e
descobrir a ausência depois de desenhar o processo em volta dela é caro.

- **Sem recorrência própria.** Cada acontecimento dispara a regra uma vez. Uma
  série — a periodicidade de um PMOC — é evento recorrente da Agenda.
- **Sem webhook, URL ou requisição HTTP.** O que uma regra aciona é trabalho
  interno de uma lista fechada do servidor.
- **Sem data absoluta.** O prazo é sempre relativo ao acontecimento; "todo dia
  5" é agenda.
- **Sem script, fórmula, SQL ou template executável.**
- **Sem ramificação, laço ou aprovação humana no meio.**
- **Sem teto de disparos** por regra ou por período.
- **Sem histórico detalhado de fila** — ver "O histórico", acima.
- **`CREATE_FOLLOW_UP_OPERATION` indisponível**, com o motivo do servidor: uma
  ordem de serviço exige código único e não há regra automática de numeração. A
  ação aparece no seletor, desabilitada, em vez de ser escondida.
- **Sem seletor de cliente, equipamento ou item na condição.** Esses campos são
  texto, com dica do que se espera. Um seletor exigiria busca por rótulo dentro
  do editor de automação, que o contrato de automação não oferece.
- **Sem cancelamento de uma ação agendada individualmente.** Desliga-se a regra,
  e a ação pendente é descartada quando chegar a hora.

## Validação

34 verificações contra a API real (`node validate-automations-ui.mjs`), todas
passando, cobrindo os 15 cenários pedidos:

criar · editar (preservando o `id` da ação) · ativar/desativar · duplicar ·
excluir quando permitido · condição compatível · condição inválida recusada
(campo, gatilho, chave de configuração e fila) · gatilho e ação vindos do
catálogo, com `options` publicadas e sem `PREVENTIVE` · **prazo de seis meses
agendado na data que o Postgres calcularia** · regra por unidade, com unidade de
outra organização recusada · 403 sem permissão e 401 sem sessão · regra
desativada sem execução · regra editada com ação futura ainda agendada e
exclusão recusada com 409 · **lembrete real aparecendo na Agenda, apontando para
a operação que o originou**.

Mais: `tsc --noEmit`, `eslint .` (0 erros), `next build` e `git diff --check`.
