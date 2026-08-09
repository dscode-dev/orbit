# Inventory Engine (PR-23)

O que entrou e o que saiu de cada prateleira, e quanto tem agora.

## O invariante principal

**Estoque não é um número editável.**

```
CatalogItem ──▶ InventoryMovement (ledger) ──▶ InventoryBalance (projeção)
```

Não existe rota que escreva quantidade. Nenhum `PATCH /balances/:id`. Quem
quiser mudar o saldo registra um movimento, e o movimento fica — um endpoint
que editasse o número tornaria o livro decorativo: o saldo passaria a ser a
verdade, e o histórico, uma sugestão.

A projeção existe por desempenho: perguntar "quanto tem" não pode custar a soma
de todo o histórico. Ela **nunca é fonte independente** — cada movimento a
atualiza na mesma transação, e `balanceAfter` guarda o resultado para que
divergência entre livro e projeção seja detectável.

## Concorrência e saldo negativo

A garantia **não** é ler e depois escrever. Entre as duas cabe outra transação,
e é exatamente aí que estoque vira negativo em sistemas que "checam antes".

A garantia é uma instrução:

```sql
UPDATE inventory_balances
   SET on_hand = on_hand - $qtd
 WHERE business_unit_id = $u AND catalog_item_id = $i
   AND on_hand - reserved >= $qtd
RETURNING on_hand
```

O predicado é avaliado **sob o bloqueio de linha** que o próprio `UPDATE`
adquire. Duas saídas concorrentes serializam: a segunda vê o saldo já
descontado e, se não couber, afeta zero linhas — e zero linhas é a recusa.

`CHECK (on_hand >= 0)` é a última linha de defesa, válida para qualquer caminho
que venha a escrever ali, inclusive um script.

> **Provado no E2E:** saldo 10, dez saídas simultâneas de 2. Exatamente cinco
> aceitas, cinco recusadas com 409, saldo final `0.000` — e a soma do livro
> igual a 10.

A entrada usa `INSERT … ON CONFLICT (business_unit_id, catalog_item_id) DO
UPDATE`: duas entradas simultâneas do mesmo item não criam duas linhas de saldo.

## Escopo

Estoque é da **unidade de negócio**. O mesmo item tem saldos diferentes em
filiais diferentes, e a visão de item devolve os saldos por unidade **sem
somar** — somar quilos de gás de três filiais dá um número que não corresponde a
nenhuma prateleira, e é o tipo de total que leva alguém a prometer uma peça que
está a duzentos quilômetros.

Só `PRODUCT` e `PART` têm estoque. `SERVICE` é recusado com **400**, não 404: o
item existe, mas não é estocável — dizer "não encontrado" mandaria alguém
procurar um cadastro que está lá.

## Movimentos

`ENTRY` · `CONSUMPTION` · `RETURN` · `ADJUSTMENT_IN` · `ADJUSTMENT_OUT` ·
`TRANSFER_IN` · `TRANSFER_OUT`

Quantidade **sempre positiva**, `Decimal(14,3)` — estoque em HVAC-R se mede em
fração: quilos de gás, metros de tubo. A direção é do tipo, nunca do sinal: um
movimento negativo permitiria registrar saída como entrada de sinal trocado, e a
soma do livro passaria a depender de como cada linha foi digitada.

**Append-only.** Não há edição nem exclusão. Contagem que deu diferença vira
ajuste, com motivo obrigatório; o histórico anterior permanece, porque é ele que
explica o saldo que alguém já conferiu.

> Defeito encontrado pelo E2E: `InventoryAdjustmentDto` redeclarava `reason` com
> `declare`, e `declare` **não emite decorador nenhum** — a validação sumia em
> silêncio e ajuste sem explicação passava. O motivo saiu da classe base e cada
> rota declara o seu, com a obrigatoriedade que lhe cabe.

## Transferência

`TRANSFER_OUT` na origem e `TRANSFER_IN` no destino, na **mesma transação**,
com o mesmo `transferId`. A saída vai primeiro: se o saldo não cobrir, a exceção
sobe antes de a entrada existir, e o rollback cuidaria dela de qualquer forma.

Não existe meia transferência. O `CHECK` da tabela exige que `transfer_id` e
`counterpart_unit_id` andem juntos, e que a contraparte seja outra unidade.

A RLS exige acesso às **duas** pontas: a inserção do lado de destino passa pelo
`WITH CHECK` daquela unidade, então uma sessão sem ela é recusada pelo banco,
não por uma verificação no serviço.

> **Provado no E2E:** transferência de 4 movendo os dois saldos; tentativa de
> 9999 devolvendo 409 com os dois saldos intactos e nenhum movimento órfão.

## Estoque mínimo

`minimumStock` por par item + unidade — a filial que atende hospital precisa de
mais filtro em casa que a que atende escritório.

É a **única escrita do módulo que não é movimento**, e não altera saldo: mínimo
é política de reposição, não quantidade. `PUT`, porque mandar o mesmo mínimo
duas vezes é o mesmo estado. Cria a linha com `on_hand = 0` quando ainda não
existe — configurar o mínimo antes da primeira compra é o caso normal.

O estado é do **servidor**:

| Estado | Quando |
| --- | --- |
| `OUT_OF_STOCK` | saldo ≤ 0, com ou sem mínimo — não ter a peça é um fato |
| `LOW` | há mínimo definido e saldo ≤ mínimo |
| `OK` | o resto |

`LOW` só existe quando há mínimo: sem régua, chamar algo de baixo seria opinião
do sistema.

## Operações

`CONSUMPTION` aceita `operationId`, verificado contra a organização.

**Nada é deduzido de orçamento.** Proposta é intenção comercial, e o que se usa
na visita costuma diferir do que foi orçado — deduzir automaticamente daria
baixa em peça que ninguém tirou da prateleira. O consumo é registrado por quem
esteve lá.

## Idempotência

Índice único parcial:

```sql
CREATE UNIQUE INDEX inventory_movements_source_unique
  ON inventory_movements(organization_id, source, source_entity_id, catalog_item_id)
  WHERE source <> 'MANUAL' AND source_entity_id IS NOT NULL;
```

A chave inclui o **item** porque uma mesma origem — uma ordem de serviço, um
registro de campo — costuma consumir vários materiais. A granularidade certa é
"esta origem, este item".

Sem `sourceEntityId` não há idempotência, e é o correto: duas entradas iguais
digitadas por alguém são dois fatos, não um repetido. A resposta traz
`duplicated: true` quando a origem já produziu o movimento — retry, não erro.

## Reservas — apenas a fundação

`reserved` existe na projeção, com `CHECK (reserved >= 0)` e
`CHECK (reserved <= on_hand)`, e o Read Model publica
`available = onHand − reserved`. O `UPDATE` de saída já desconta contra
`on_hand - reserved`.

**Nenhum caminho escreve `reserved` hoje, e não há endpoint de reserva.**
Reservar exige um reservador com ciclo de vida — algo que reserve, libere e
converta em consumo — e hoje não existe: orçamento é intenção comercial (esta
PR proíbe deduzir dele) e operação não tem plano de materiais.

A fundação evita que a PR futura reformate projeção e contrato. Inventar um
endpoint de reserva agora, sem quem reserve, produziria a "reserva superficial"
que o enunciado dispensa.

## Analytics

`/inventory/analytics/summary` e `/consumption`: contagens de itens controlados,
baixos e zerados; movimentos do período por direção; consumo por item.

**Nenhum valor monetário, em nenhum campo.** `costPrice` do Catálogo é o preço
de hoje, não o custo das unidades que estão na prateleira; sem FIFO ou custo
médio não existe regra autoritativa, e qualquer valoração seria um número
inventado com aparência de contabilidade. O E2E verifica o payload inteiro
contra `cost`, `price`, `value`, `amount` e `currency`.

Transferência conta **um** movimento por par, não dois: as duas pontas são o
mesmo fato visto de dois lados, e contá-las separadamente dobraria as
"movimentações" do período sem que nada a mais tivesse acontecido.

## Segurança

RLS com `FORCE ROW LEVEL SECURITY` nas duas tabelas, exigindo organização **e**
unidade.

`inventory.read` e `inventory.manage` são **independentes de `catalog.read`**:
consultar a tabela de preços não é o mesmo que saber, ou mexer, no que há
fisicamente na prateleira de cada filial.

> **Provado contra a API:** com um plano que tem `catalog.read` e
> `catalog.manage` mas não `inventory.*`, as oito rotas de estoque respondem
> **403** enquanto `GET` e `POST /catalog/products` continuam **200** e **201**.

Auditoria em todo movimento (`INVENTORY_<TIPO>`), na transferência
(`INVENTORY_TRANSFERRED`) e no mínimo (`INVENTORY_MINIMUM_SET`).

## Endpoints

| Método | Rota | Capability |
| --- | --- | --- |
| `GET` | `/inventory/balances` | `inventory.read` |
| `GET` | `/inventory/items/:catalogItemId` | `inventory.read` |
| `GET` | `/inventory/movements` | `inventory.read` |
| `POST` | `/inventory/entries` | `inventory.manage` |
| `POST` | `/inventory/consumptions` | `inventory.manage` |
| `POST` | `/inventory/returns` | `inventory.manage` |
| `POST` | `/inventory/adjustments` | `inventory.manage` |
| `POST` | `/inventory/transfers` | `inventory.manage` |
| `PUT` | `/inventory/minimums` | `inventory.manage` |
| `GET` | `/inventory/analytics/summary` | `inventory.read` |
| `GET` | `/inventory/analytics/consumption` | `inventory.read` |

Cada ação tem endpoint próprio. Um `POST /movements { type }` genérico
permitiria registrar consumo como entrada por um erro de digitação, e o ajuste
— o único que exige motivo — deixaria de exigir.

Filtros de `/movements`: `search`, `type`, `businessUnitId`, `catalogItemId`,
`operationId`, `source`, `from`, `to`, `page`, `limit`. De `/balances`:
`search`, `businessUnitId`, `catalogItemId`, `lowStock`, `page`, `limit`.

O filtro `lowStock` compara duas colunas, o que o Prisma não expressa no
`where`; vira SQL cru sobre os ids elegíveis, e a listagem continua paginada
pelo banco — trazer tudo para filtrar em memória daria a página errada assim que
o estoque crescesse.

## Lacunas declaradas

- **Reservas**: só a fundação, conforme acima.
- **Sem WMS**: endereçamento, corredor, posição.
- **Sem fornecedor e compras**: entrada registra que chegou, não de quem.
- **Sem lote, número de série e validade**: o saldo é uma quantidade, não um
  conjunto de unidades identificadas.
- **Sem inventário físico completo**: existe ajuste por item; não existe uma
  contagem que congele o estoque e concilie tudo de uma vez.
- **Sem custo médio, FIFO, LIFO e valoração**: sem regra autoritativa de custo.
- **Sem fiscal, código de barras e previsão de demanda.**
- **Sem transferência em trânsito**: a transferência é instantânea; não há
  estado "saiu de A e ainda não chegou em B". Modelá-lo exigiria um terceiro
  saldo (em trânsito) e um aceite no destino.

## Testes

- `inventory.service.spec.ts` — 16 casos de regra de domínio.
- `test/inventory.e2e-spec.ts` — 16 casos contra a aplicação montada: entrada
  criando saldo, consumo reduzindo com vínculo à operação, serviço recusado,
  negativo recusado, **dez saídas concorrentes com exatamente cinco aceitas**,
  ajuste preservando histórico e exigindo motivo, transferência com identidade
  compartilhada movendo os dois saldos, transferência impossível sem deixar
  metade, mesma unidade recusada, mínimo definindo `OK`/`LOW`/`OUT_OF_STOCK` sem
  mover saldo, `available` refletindo `onHand`, retry com a mesma origem não
  duplicando, filtros e paginação, analytics sem nenhum campo financeiro, e
  isolamento entre organizações.
