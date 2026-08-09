# Commercial Engine — Quotes (PR-22)

Proposta comercial: o que se ofereceu, por quanto, até quando. Aprovada, vira
receita **prevista**; convertida, vira trabalho.

## O que este domínio não é

Não é pedido, contrato nem documento fiscal. Não emite NF-e/NFS-e, não cobra,
não parcela, não calcula imposto nem comissão, não move estoque, não concilia
banco e não mantém funil de CRM. Propõe um valor e registra a resposta.

## Máquina de estados

```
DRAFT ──send──▶ SENT ──approve──▶ APPROVED ──cancel──▶ CANCELLED
  │               │  ├─reject────▶ REJECTED
  │               │  └─(validade)▶ EXPIRED
  └──cancel───────┴──cancel─────▶ CANCELLED
```

`REJECTED`, `EXPIRED` e `CANCELLED` são terminais. A tabela de transições vive
em `TRANSITIONS`, no serviço — uma linha a mais é toda a mudança quando um
estado novo aparecer.

**Não existe `PATCH /quotes/:id/status`.** Cada transição tem nome de negócio
porque registra coisas diferentes: quem enviou, quem decidiu, por quê. Um campo
genérico apagaria a distinção e permitiria saltar de rascunho a aprovado sem
que nada tivesse sido proposto.

### Pré-condições de envio

Enviar exige **item, valor e validade**. Um orçamento vazio ou de R$ 0,00 é um
documento que não propõe nada, e sem prazo o preço de hoje passa a valer para
sempre.

### Conversão não é estado

Ter virado operação é `operationId` preenchido. Um orçamento convertido
continua `APPROVED`: o que mudou não foi a proposta, foi a existência de
trabalho por causa dela.

## Dinheiro

`Decimal(14,2)`; quantidade em `Decimal(14,3)`, porque serviço se mede em horas
e meia hora existe. Publicado como **string**, como no Financeiro.

**Toda conta é do Postgres.** O total do item é
`ROUND(quantidade × preço, 2) − desconto`, e essa expressão está gravada em um
`CHECK`. Calcular o mesmo valor em JavaScript exigiria reproduzir o
arredondamento do `numeric` em ponto flutuante — e no dia em que as duas
implementações discordassem em um centavo, o banco recusaria a escrita com uma
violação de constraint que ninguém saberia explicar. Item e totais são
calculados em SQL, pelo mesmo motor que os valida.

O desconto do orçamento é aparado ao subtotal em `LEAST`: remover itens de uma
proposta com desconto grande produziria total negativo, e a escrita falharia no
meio de uma operação que o usuário via como "apagar uma linha".

> Defeito encontrado pelos próprios testes: gravar `discount` sozinho pelo
> Prisma violava `total = subtotal − discount` **antes** de o recálculo rodar,
> porque o `CHECK` é avaliado a cada instrução. O desconto passou a entrar pelo
> `recalculate`, que ajusta os três valores de uma vez.

## Snapshot do item

Descrição, SKU, unidade, tipo e preço são gravados quando o item entra.
`catalogItemId` guarda a origem para rastreabilidade, com `ON DELETE SET NULL`
— apagar o produto não apaga o item.

O orçamento **não lê o Catálogo para exibir nada**. Mudar o preço amanhã não
pode mudar o que já foi proposto a um cliente, e uma proposta que muda de valor
sozinha é uma proposta que ninguém pode honrar. O preço do Catálogo é sugestão
inicial: informar `unitPrice` sobrepõe, porque negociar é o que um orçamento
faz.

## Invariantes garantidos pelo banco

| Constraint | O que impede |
| --- | --- |
| `quotes_organization_id_number_key` | dois orçamentos com o mesmo número |
| `quotes_operation_id_key` | duas propostas apontando para a mesma operação |
| `quotes_total_matches` | total que não é `subtotal − discount` |
| `quotes_discount_within_subtotal` | orçamento de valor negativo |
| `quotes_sent_stamp` · `quotes_decided_stamp` | estado sem o carimbo que o explica |
| `quotes_conversion_pair` | `operation_id` sem `converted_at`, e vice-versa |
| `quote_items_total_matches` | total de item que não bate com a aritmética |
| `quote_items_kind_valid` | tipo fora de `PRODUCT/SERVICE/PART` |

A numeração é atribuída sob `pg_advisory_xact_lock`, como a revisão do manifest:
duas propostas criadas no mesmo instante não podem receber o mesmo número.

## Concorrência

**Transições** usam `updateMany` com o status de origem no `where`. Se outra
requisição já mudou o estado, zero linhas são afetadas e a transição é recusada
com 409 — é a proteção contra dois cliques em "aprovar", onde o segundo
sobrescreveria autor e data do primeiro.

**Conversão** é serializada por `pg_advisory_xact_lock` sobre o orçamento.

> Segundo defeito encontrado pelos testes: sem a trava, quatro conversões
> simultâneas criavam quatro operações com o **mesmo código** — derivado do
> código do orçamento — e colidiam no índice único de `operations`, devolvendo
> 500. Com a trava, a segunda encontra `operationId` preenchido e devolve o que
> existe, sem criar nada para depois desfazer.

## Isolamento

RLS com `FORCE ROW LEVEL SECURITY` em ambas as tabelas. `quotes` exige
organização **e** unidade; `quote_items` herda pela política do orçamento — um
item sozinho não significa nada, e duplicar a regra abriria espaço para as duas
divergirem.

## Autorização

`quotes.read` vê; `quotes.manage` cria, edita e decide. As duas são
**independentes** de `crm.read` e `catalog.read`: ter a carteira de clientes ou
a tabela de preços não é o mesmo que poder propor um valor em nome da empresa.

A conversão exige, além disso, `operations.manage` + `operations.create`: abrir
trabalho em campo é ato do domínio de operações, e quem só cuida de propostas
não o faz sozinho.

Na migração, as permissões vão apenas a papéis que já administram a organização
(`'*' = ANY(permissions)`).

## Quote → Financial

```
POST /quotes/:id/approve
        │
        ▼
QuoteRepository.transition()  ── transação ──┐
  status = APPROVED, decidedAt, decidedById  │
  AuditLog QUOTE_APPROVED                    │
  enqueue(quote.status.changed, key id:to)  ─┘  outbox
        │
        ▼  worker, no contexto do tenant
QuoteFinancialProcessor
        │
        ▼
FinancialEntry  INCOME · **PENDING** · source QUOTE · sourceEntityId = quoteId
                competência = decisão · vencimento = validade
```

**Aprovar não é receber.** O lançamento nasce `PENDING`: o trabalho não foi
feito e o dinheiro não entrou. Lançar como realizado inflaria o caixa com
expectativa — exatamente o que a separação da PR-21 existe para impedir.

O evento é enfileirado **dentro da transação**. Chamada direta abriria uma
janela: o processo morre entre a aprovação e o lançamento, e a proposta fica
aprovada sem previsão nenhuma — perda silenciosa.

A idempotência é a mesma da PR-21: índice único parcial em
`(organization_id, source, source_entity_id)`. Retry, concorrência e job
devolvido pelo tempo limite convergem para **um** lançamento.

### Cancelamento

`CANCELLED` dispara o mesmo evento, e o processador **cancela** a receita
prevista — sem apagá-la: a previsão existiu e alguém a viu no relatório. O
processador lê o **estado atual**, não o do payload: um job atrasado que chegasse
depois de aprovar-e-cancelar recriaria uma previsão já cancelada.

A operação criada por uma conversão **não é tocada**. Se há trabalho em campo,
quem decide encerrá-lo é o domínio de operações; desfazê-lo daqui apagaria
histórico de execução por causa de uma decisão comercial.

## Quote → Operation

`POST /quotes/:id/convert-to-operation`, só de `APPROVED`, só uma vez.

Reutiliza `Operation` — não há segunda entidade de serviço. O código deriva do
código do orçamento (`ORC-000042` → `OS-ORC-000042`), para que a origem seja
legível na listagem de operações sem abrir nada, e `data.quoteId` guarda o
vínculo do lado da operação.

**Nada é inventado.** Técnico, execução, checklist e agenda não são atribuídos:
o contrato de `Operation` os trata como decisões posteriores, e escolhê-los aqui
produziria uma ordem de serviço que ninguém combinou. `kind`, `priority` e
agendamento são aceitos porque o orçamento não os conhece e alguém precisa
informá-los.

## Expiração

**Sem scheduler.** A plataforma não tem `@nestjs/schedule` nem cron, e o
Background Job Engine processa filas — não agenda. O precedente da casa é
`IdentityRepository.listInvitations`, que marca `EXPIRED` antes de listar.

A expiração acontece no banco, dentro da transação RLS, **antes de toda leitura
e de toda transição**:

```sql
UPDATE quotes SET status = 'EXPIRED', expired_at = now()
 WHERE status = 'SENT' AND valid_until < CURRENT_DATE
```

Só atinge `SENT`: rascunho não venceu porque nunca foi proposto, e aprovado não
vence porque a decisão já aconteceu. Um orçamento nunca é **observado** como
válido depois do prazo, e o relógio que decide é o do servidor.

O limite honesto: uma proposta que ninguém abre permanece `SENT` na tabela até
alguém olhar. Isso não afeta correção — nenhuma leitura e nenhuma transição a
enxergam como válida —, mas um relatório escrito em SQL cru fora do módulo
veria o estado antigo. Uma varredura periódica resolveria, e exigiria um
scheduler que a plataforma não tem.

## Endpoints

| Método | Rota | Capability · Permissão |
| --- | --- | --- |
| `GET` | `/quotes` | `quotes.read` |
| `GET` | `/quotes/:id` | `quotes.read` |
| `POST` | `/quotes` | `quotes.manage` |
| `PATCH` | `/quotes/:id` | `quotes.manage` |
| `DELETE` | `/quotes/:id` | `quotes.manage` |
| `POST` | `/quotes/:id/items` | `quotes.manage` |
| `PATCH` | `/quotes/:id/items/:itemId` | `quotes.manage` |
| `DELETE` | `/quotes/:id/items/:itemId` | `quotes.manage` |
| `POST` | `/quotes/:id/send` | `quotes.manage` |
| `POST` | `/quotes/:id/approve` | `quotes.manage` |
| `POST` | `/quotes/:id/reject` | `quotes.manage` |
| `POST` | `/quotes/:id/cancel` | `quotes.manage` |
| `POST` | `/quotes/:id/convert-to-operation` | `quotes.manage` + `operations.manage` |

`DELETE /quotes/:id` só apaga rascunho. Proposta enviada é **cancelada**, e o
motivo fica: apagar o que o cliente já viu destruiria a explicação de um negócio
perdido.

Filtros de `GET /quotes`: `search`, `status`, `customerId`, `businessUnitId`,
`from`, `to`, `validUntilBefore`, `page`, `limit`.

## Read Models

`QuoteReadModel` publica `transitions` — `canEdit`, `canSend`, `canApprove`,
`canReject`, `canCancel`, `canConvert`. É **descrição, não autorização**: quem
recusa continua sendo o servidor a cada requisição. Publicá-la evita que cada
cliente reimplemente a máquina de estados, que é como duas interfaces passam a
discordar sobre o que um orçamento aceita.

`isExpired` também é do servidor, pela mesma razão que no Financeiro.

## Alteração fora do módulo

Uma: `FinancialService.recordFromSource` ganhou `type`, `status` e `dueDate`
opcionais. Fixava `CONFIRMED` porque só recibo o usava; os defaults preservam
esse comportamento. Acrescentou-se também `cancelFromSource`, a compensação de
uma origem que deixou de valer — que **não apaga**, cancela.

## Preparado, não implementado

**Documento do orçamento.** O Artifact/Rendering Engine já sabe gerar PDF a
partir de um `ArtifactTemplate`, e o catálogo oficial já traz `ORBIT_ORCAMENTO`
(`artifactType: 'ORCAMENTO'`). O caminho é criar uma `ArtifactExecution` a
partir do orçamento e emitir pelo motor existente — **nenhum segundo gerador de
PDF**. Falta apenas o mapeamento de itens para as seções do template, que é
trabalho de uma PR própria: aumentar o escopo aqui produziria um mapeamento
adivinhado.

Note o cuidado já tomado: `ORCAMENTO` está **fora** de `RECEIPT_ARTIFACT_TYPES`
no Financeiro. Emitir o documento de um orçamento não lançará receita
confirmada — quem lança é a aprovação, como previsto.

## Lacunas declaradas

- Sem NF-e/NFS-e, gateway, cobrança, contas bancárias, conciliação,
  parcelamento, fiscal, comissão, funil de CRM, assinatura eletrônica comercial
  e estoque — todos fora do escopo desta PR.
- Sem revisão/versão de proposta: alterar preço depois de enviado exige criar
  outra proposta. `number` e `code` não têm sufixo de revisão.
- Sem conversão de moeda: `currency` é gravada, mas não há taxa de câmbio.
- Sem envio por e-mail: `send` muda o estado e registra quem enviou; a entrega
  ao cliente acontece fora da plataforma.
- Expiração preguiçosa, conforme explicado acima.

## Testes

- `quote.service.spec.ts` — 28 casos de regra de domínio.
- `test/quotes.e2e-spec.ts` — 14 casos contra a aplicação montada: criação
  numerada, múltiplos itens com soma e desconto, snapshot sobrevivendo à
  alteração do Catálogo, transições válidas e inválidas, recusa exigindo motivo,
  aprovação gerando `PENDING INCOME` único mesmo com reprocessamento,
  cancelamento refletindo no previsto sem apagá-lo, conversão única, quatro
  conversões simultâneas produzindo uma operação só, conversão recusada sem
  aprovação, expiração bloqueando aprovação, filtros e paginação, isolamento
  entre organizações e recusa de cliente/unidade de outra organização.
