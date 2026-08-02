# Artifact Execution Workspace

Ambiente de execução e acompanhamento de um Artifact. Consome exclusivamente o
módulo `artifact-executions` (PR-18), pelo BFF.

|              |                                                                                    |
| ------------ | ---------------------------------------------------------------------------------- |
| Rotas        | `/execucoes` (listagem) e `/execucoes/[id]` (workspace)                            |
| Capabilities | `artifact_executions.read` para abrir, `artifact_executions.execute` para escrever |
| Permissões   | `artifact_executions.read` · `.execute`                                            |
| Contratos    | `src/types/contracts/modules/artifact-executions/` (sincronizados)                 |

Esta tela é a base da experiência que será compartilhada com o aplicativo
móvel: o modelo de renderização por tipo de campo e a leitura única do detalhe
foram desenhados para migrar sem reescrita.

---

## 1. Endpoints utilizados

| Endpoint                                    | Uso no Workspace                                  |
| ------------------------------------------- | ------------------------------------------------- |
| `GET /artifact-executions`                  | listagem, busca, filtro por status, paginação     |
| `GET /artifact-executions/:id`              | leitura única que alimenta quase todos os painéis |
| `PATCH /artifact-executions/:id/status`     | ações de status                                   |
| `PUT /artifact-executions/:id/responses`    | gravação de resposta, campo a campo               |
| `POST /artifact-executions/:id/attachments` | registro de anexo                                 |
| `GET /artifact-executions/:id/progress`     | recarga isolada do progresso                      |
| `GET /operations/:id`                       | resolve operação, cliente e ativo vinculados      |

Não consumidos, e por quê:

| Endpoint                                   | Motivo                                                              |
| ------------------------------------------ | ------------------------------------------------------------------- |
| `POST /artifact-executions`                | criar execução é fluxo de agendamento/operação, não deste Workspace |
| `PATCH /artifact-executions/:id`           | edição de metadados; a tela é de execução, não de cadastro          |
| `POST /artifact-executions/:id/signatures` | coleta de assinatura está fora do escopo desta PR                   |

---

## 2. Uma leitura, muitos painéis

`GET /artifact-executions/:id` devolve, no mesmo payload: snapshot completo,
respostas, anexos, assinaturas, insights, equipe e `progressDetails`.

Distribuir esse objeto por props evita dez requisições para montar a tela e —
o que importa mais — evita que dez painéis mostrem versões diferentes do mesmo
estado. O único painel com leitura própria é o de vínculos, que busca a
operação.

**Independência dos painéis** vem do `PanelFrame`, que já embute Error Boundary
local (PR-03). Um painel que quebre ao renderizar mostra a própria falha; os
demais continuam utilizáveis, inclusive o de status, por onde o trabalho anda.

---

## 3. Field Registry

O Workspace **não conhece PMOC, Ordem de Serviço nem Relatório Técnico**. Ele
percorre `snapshot.sections[].fields[]` e pergunta ao registry quem sabe
desenhar cada tipo:

```
snapshot.sections[].fields[]  ──>  resolveFieldRenderer(field.type)  ──>  { View, Editor }
```

Mesma filosofia do Metric Registry e do Widget Registry, inclusive no
comportamento diante do desconhecido: **um tipo não registrado não quebra a
tela**. Ele cai na apresentação estruturada — mostra o valor como ele é e
permite editá-lo como JSON — e avisa no console em desenvolvimento, uma vez por
tipo.

Isso não é tolerância exagerada: `ArtifactFieldDto` valida o formato do tipo
(`/^[A-Z][A-Z0-9_.-]*$/`) e diz textualmente que _"the engine does not
interpret it"_. Um tenant pode criar `TERMOGRAFIA` amanhã sem avisar ninguém.

### Famílias registradas

| Família          | Tipos                                         |
| ---------------- | --------------------------------------------- |
| texto            | `TEXT`, `QR_CODE`, `BARCODE`                  |
| texto longo      | `LONG_TEXT`, `OBSERVATION`                    |
| número           | `NUMBER`, `DECIMAL`                           |
| confirmação      | `CHECKBOX`, `SWITCH`                          |
| escolha          | `SELECT`, `RADIO`                             |
| múltipla escolha | `MULTISELECT`                                 |
| data e hora      | `DATE`, `TIME`, `DATETIME`                    |
| mídia            | `PHOTO`, `VIDEO`, `FILE`                      |
| assinatura       | `SIGNATURE` (só leitura — ver §6)             |
| estruturado      | `LOCATION` e **qualquer tipo não registrado** |

**Acrescentar um tipo é acrescentar uma linha no registry.** Nenhum arquivo do
Workspace muda.

As opções de um campo de escolha saem de `field.configuration`, que é JSON
livre: o leitor aceita `options`/`choices`/`values`, com itens em texto ou em
objeto (`value`/`id`/`key` e `label`/`title`/`name`). Quando não reconhece
nenhuma forma, o campo vira entrada livre — melhor que uma lista vazia que
travaria o preenchimento.

---

## 4. Progresso e status: onde mora a autoridade

| Decisão                                          | Quem decide                                     |
| ------------------------------------------------ | ----------------------------------------------- |
| Percentual, campos pendentes, seções completas   | backend (`ArtifactExecutionProgressCalculator`) |
| Se a execução pode ser encerrada (`canComplete`) | backend                                         |
| Se uma transição é válida                        | backend (`ArtifactExecutionStateMachine`)       |
| Se a execução aceita escrita                     | backend (`ArtifactExecutionPolicy`)             |
| Se o campo existe no snapshot                    | backend (`ArtifactExecutionValidator`)          |
| Se o usuário pode executar                       | backend (`@Permissions`, `@Capabilities`)       |

O painel de status oferece **todos** os destinos menos o atual, envia a
intenção e apresenta a recusa. Verificado contra a API real:

```
DRAFT -> COMPLETED     INVALID_ARTIFACT_EXECUTION_TRANSITION
-> UNDER_REVIEW        ARTIFACT_EXECUTION_INCOMPLETE
```

### Editabilidade aprendida, não deduzida

`assertEditable` aceita escrita em `DRAFT`, `IN_PROGRESS` e `PAUSED`. Essa
lista **não está no frontend**. O Workspace tenta e escuta: ao receber
`ARTIFACT_EXECUTION_NOT_EDITABLE`, os painéis de escrita passam a se apresentar
como consulta pelo resto da visita, com a mensagem que veio do servidor.

```
escrever em ARQUIVADA  →  ARTIFACT_EXECUTION_NOT_EDITABLE
                          "Execution cannot be edited while ARCHIVED"
```

A regra continua sendo do servidor; o que o cliente guarda é a resposta que já
recebeu, para não insistir no que sabe que será recusado. Se o backend mudar a
política amanhã, o frontend acompanha sem alteração.

---

## 5. Query Layer e concorrência

```
services/artifact-executions.service.ts     espelho do controller
hooks/artifact-executions/                  queries e mutations
```

Três decisões:

**A resposta da mutação semeia o cache.** Salvar resposta, mudar status e
registrar anexo devolvem a execução **inteira**, com `progressDetails` já
recalculado. Escrever esse retorno no cache evita um `GET` redundante e a
janela em que a tela mostra progresso velho. Confirmado na prática: cada
resposta salva voltou com o percentual novo (25% → 50%).

**Escritas da mesma execução são serializadas** pelo `scope` do TanStack Query.
Sem isso, dois campos salvos em sequência rápida disputam a última palavra
sobre o cache — o servidor persiste ambos, mas o retorno mais lento, embora
mais antigo, sobrescreveria o mais rápido.

**A leitura em voo é cancelada antes de semear** (`cancelQueries`), para que um
`GET` disparado antes da escrita não aterrisse depois dela.

Invalidação: só `queryKeys.lists("artifact-executions")` — a listagem exibe
status e progresso e envelhece a cada escrita. O detalhe não é invalidado
porque acabou de ser semeado com dado mais novo do que uma releitura traria.

### Cadências

| Leitura   | `staleTime` | `refetchInterval` |
| --------- | ----------- | ----------------- |
| Listagem  | 30 s        | 1 min             |
| Detalhe   | 15 s        | —                 |
| Progresso | 15 s        | —                 |

O detalhe não se atualiza sozinho de propósito: é uma tela de trabalho, e
recarregar por conta própria enquanto alguém preenche campos atrapalharia.

---

## 6. Assinaturas

Os espaços vêm do Snapshot, as coletas vêm da execução. O cruzamento dá quatro
estados:

| Estado    | Como se identifica                                |
| --------- | ------------------------------------------------- |
| Realizada | há assinatura para o `slotId`, sem `revokedAt`    |
| Revogada  | há assinatura, com `revokedAt`                    |
| Pendente  | não há assinatura e a execução aceita escrita     |
| Bloqueada | não há assinatura e a execução não aceita escrita |

"Bloqueada" não é regra inventada: reflete a recusa que o servidor já deu, ou a
ausência de permissão de execução.

**Assinar não faz parte desta entrega.** O endpoint existe, exige
`signatureData` e produz um SHA-256 no servidor — coleta com validade jurídica
é módulo próprio.

---

## 7. renderStatus

O contrato passou a publicar `renderStatus` com cinco valores
(`NOT_RENDERED`, `PENDING`, `RENDERING`, `READY`, `FAILED`). **O backend
responde sempre `NOT_RENDERED`** — não há motor de renderização, e esta PR não
implementa renderização nem PDF.

A interface trata os cinco estados desde já, na listagem e no Workspace. Quando
o motor entrar, nada muda no frontend.

`NOT_RENDERED` é apresentado como **ausência**, não como espera: dizer
"aguardando" sugeriria que algo está por vir.

---

## 8. Limitações encontradas no backend

| Limitação                                                                                                                                          | Consequência na tela                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anexo não recebe binário** — `RegisterArtifactAttachmentDto` pede `storageKey`, e não há rota de upload, download ou URL assinada para execuções | o painel registra anexos a partir de uma chave existente e declara que envio, download e pré-visualização dependem de rotas que não existem |
| **Sem endpoint de membros do tenant**                                                                                                              | equipe e responsável aparecem pelo identificador abreviado; nomes exigiriam `GET /organizations/current/members`                            |
| **Sem leitura de auditoria** — `auditLog` é escrito, nenhum controller o expõe; execuções não têm tabela de histórico como `OperationHistory`      | o painel de histórico declara a ausência; a linha do tempo responde "quando", nunca "por quem"                                              |
| **Sem `groupBy` nem ordenação** em `ArtifactExecutionQueryDto`                                                                                     | o agrupamento oferecido é por status, feito no servidor (uma consulta por aba); a ordem é `createdAt desc`, declarada na tela               |
| **Sem contagem por status**                                                                                                                        | as abas de status não exibem números — sete consultas paralelas só para preenchê-los seria caro                                             |
| **Read Models de cliente e ativo não publicados**                                                                                                  | vínculos sem operação aparecem pelo id; com operação, `GET /operations/:id` resolve os três com nome                                        |
| **Nada escreve `ArtifactExecutionInsight`**                                                                                                        | o painel Orbit Intelligence lê a fonte certa e ficará vazio até algo produzir insights                                                      |
| **`kind` e `severity` de insight são `varchar` livres**                                                                                            | o painel agrupa pelos tipos convencionados e mostra qualquer outro com a chave crua                                                         |
| **`ai-executions` filtra só por `operationId`**                                                                                                    | não há como listar execuções de IA por execução de artefato                                                                                 |
| Execução só nasce de template **`ACTIVE`**                                                                                                         | não é limitação, é regra do servidor — registrada porque surpreende quem testa com rascunho                                                 |

---

## 9. Verificação contra a API real

Sequência executada contra o backend em `docker compose`, com organização e
template reais:

```
criar execução                 ✓  DRAFT · renderStatus NOT_RENDERED
resposta TEXT                  ✓  progresso 0 → 25 (servidor)
resposta DECIMAL               ✓  progresso 25 → 50 (servidor)
campo fora do snapshot         ✓  VALIDATION_ERROR
DRAFT → COMPLETED              ✓  INVALID_ARTIFACT_EXECUTION_TRANSITION
DRAFT → IN_PROGRESS            ✓
→ UNDER_REVIEW (incompleta)    ✓  ARTIFACT_EXECUTION_INCOMPLETE
registrar anexo                ✓
→ PAUSED → ARCHIVED            ✓
escrever em ARQUIVADA          ✓  ARTIFACT_EXECUTION_NOT_EDITABLE
GET /:id/progress              ✓  canComplete: false
GET /artifact-executions       ✓  renderStatus no item da lista
```

---

## 10. O que **não** foi implementado no frontend

Confirmação explícita, para o caso de alguém procurar:

- nenhuma máquina de estados — só a lista de destinos possíveis;
- nenhum cálculo de progresso — todo número vem de `progressDetails`;
- nenhuma validação de resposta — `validations` é JSON que o executor
  interpreta;
- nenhuma decisão de editabilidade — aprendida da recusa do servidor;
- nenhuma geração de IA — apenas apresentação de `insights`;
- nenhum componente específico de artefato — o registry é a única ponte entre
  tipo e apresentação.
