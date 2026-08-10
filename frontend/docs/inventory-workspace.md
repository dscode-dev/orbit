# Inventory Workspace (PR Frontend-21)

Consome exclusivamente os contratos da Backend PR-23 (`/inventory/**`). Sem
mocks, sem saldo local e sem regra de estoque no navegador.

## Onde ele mora

**Catálogo continua sendo a porta de entrada.** Estoque não virou domínio de
menu: quem procura uma peça procura no catálogo, e o saldo é um atributo dela
naquela unidade — não um cadastro paralelo.

```
Catálogo → aba Estoque → Item → Histórico
```

A aba declarava a ausência do domínio até a PR-23. A declaração estava certa
enquanto durou; agora mostra saldos, movimentações e panorama reais.

## O invariante, refletido na interface

**Não existe campo de quantidade editável em lugar nenhum.** Nem na tabela de
saldos, nem no detalhe do item, nem no ajuste. Não há botão de editar ou
excluir movimento — o ledger é append-only no backend, e oferecer a ação aqui
sugeriria que corrigir estoque é apagar o passado.

O ajuste diz isso com todas as letras onde é feito: *não altera o saldo
diretamente; cria uma movimentação no histórico*. Não há campo "novo saldo é
X" — informa-se **quanto** sobrou ou faltou na contagem.

## Quatro números, nunca um

Em estoque, reservado, disponível e mínimo aparecem separados em toda linha e
em todo detalhe. Respondem perguntas diferentes: o que há na prateleira, o que
já tem dono, o que dá para prometer, a partir de quando repor. Um "saldo" único
apagaria a distinção justo quando ela passar a existir.

`reserved` é **somente leitura**, e a tela explica por quê: o backend publica o
campo e calcula `available` a partir dele, mas nenhum fluxo reserva hoje. A ação
`catalog-item.stock-reserve` está declarada **indisponível** no Action Registry
— `available` aparece na tela, e a pergunta "como eu reservo?" vem logo depois.

## Status vem do servidor

`OK`, `LOW` e `OUT_OF_STOCK` são publicados em cada saldo. Não existe
`if (available < minimumStock)` no frontend: seria uma segunda régua, e as duas
discordariam sobre o que é "baixo" no primeiro empate. O filtro `lowStock`
também é do servidor — ele compara duas colunas, o que a tela não faria sem
carregar tudo.

## Movimentações

| Ação | Endpoint |
| --- | --- |
| Entrada | `POST /inventory/entries` |
| Consumo | `POST /inventory/consumptions` |
| Devolução | `POST /inventory/returns` |
| Ajuste (sobra/falta) | `POST /inventory/adjustments` |
| Transferência | `POST /inventory/transfers` |
| Estoque mínimo | `PUT /inventory/minimums` |

**A quantidade enviada é sempre positiva.** O formulário nunca inverte sinal: a
direção é do tipo, e o tipo é decidido pela rota que o diálogo chama. Um campo
que aceitasse negativo permitiria registrar saída como entrada de sinal trocado.

O ajuste exige motivo — validado pelo formulário e recusado pelo servidor com
400 se faltar.

## Transferência

`Unidade origem → Item → Quantidade → Unidade destino`, com origem e destino
mostrados num resumo antes de confirmar: é a operação em que errar de lado é
mais fácil e mais caro.

Depois do sucesso, **as duas projeções são revalidadas** pela invalidação do
hook — nenhum saldo é remendado localmente. Com uma unidade só, o diálogo diz
que não há para onde transferir em vez de oferecer um seletor vazio.

Sem trânsito: a transferência é atômica no servidor, e a tela não simula um
estado "saiu de A e ainda não chegou em B".

## Concorrência e erros

**Nenhum optimistic update.** O saldo só muda depois da resposta.

O 409 por saldo insuficiente é o caso central, e o hook o trata de forma
específica: `onError` **também invalida** as consultas de estoque. A recusa
prova que a projeção da tela está velha — outra pessoa deu baixa no intervalo —
e revalidar é o que faz o número exibido concordar com a mensagem de erro. Sem
isso, a tela mostraria 20 unidades ao lado de "só há 16 disponíveis".

Verificado: depois do 409, o saldo consultado permanece íntegro e igual ao que
o servidor informou na recusa.

Os demais casos vêm do backend e aparecem como vieram: `SERVICE` inválido
(400), unidade sem acesso (404), transferência para a mesma unidade (400),
capability ausente (403).

## Integração com o Catálogo

`PRODUCT` e `PART` mostram saldos reais por unidade no painel do item.
`SERVICE` mostra **"sem controle físico"** — nem saldo zero: zero é um número, e
um número onde não há medida vira decisão errada de compra. A consulta nem é
feita para serviços, porque o servidor a recusaria com 400.

**Preço vem do Catálogo, quantidade vem do Estoque.** Os dois contratos não se
misturam: o painel de preço não exibe saldo, e o de saldo não exibe preço.

Os saldos por unidade **não são somados**. Um total da organização não
corresponde a nenhuma prateleira, e é o tipo de número que leva alguém a
prometer uma peça que está a duzentos quilômetros.

## Integração com Operations

Seção **Materiais utilizados** na ordem de serviço, consumindo
`GET /inventory/movements?operationId=` — recorte do servidor. Mostra consumos e
devoluções, porque devolução também é fato da visita.

A ação **Registrar material** usa `POST /inventory/consumptions` com
`operationId`; a unidade padrão é a da operação, e o seletor de item cobre
apenas `PART` e `PRODUCT`.

**Nada é deduzido de orçamento.** Proposta é intenção comercial; o que sai da
prateleira numa visita costuma diferir — falta uma peça, o técnico troca por
equivalente. Deduzir daria baixa em material que ninguém tirou do estoque.

Sem `inventory.read`, a seção não aparece: não é o mesmo que "não há material",
é que a pessoa não tem acesso ao estoque.

## Registries

- **Metric Registry** — cinco métricas; `MetricCategory` ganhou `INVENTORY`,
  pela mesma razão de `FINANCIAL` e `COMMERCIAL`: não existe domínio de estoque
  no `AnalyticsDomain`, e anunciá-lo seria mentira de contrato.
- **Action Registry** — seis ações sobre a entidade `catalog-item`, mais
  `stock-reserve` indisponível.
- **Entity Registry** — **nenhuma entidade nova**. Movimento não tem tela
  própria, rota nem navegação; registrá-lo só para pendurar ações criaria uma
  entidade que nunca é destino de link. As ações vivem no item, que é onde a
  pessoa está quando decide executá-las.

## Métricas

Cinco, todas de `GET /inventory/analytics/summary`: itens controlados, estoque
baixo, sem estoque, entradas e consumos no período. **Nenhuma percorre
registros carregados** — são contagens do banco.

Não há métrica de valor: estoque não tem valoração no contrato. Não há métrica
de "volume total": somar quilos de gás com unidades de filtro produz um número
sem significado. O painel "mais consumidos" compara itens dentro da lista e diz
isso explicitamente.

## Segurança

`inventory.read` e `inventory.manage` são independentes de `catalog.read` e
`catalog.manage`. A aba, a seção do item e a seção da operação checam a
capability **antes de consultar** — perguntar assim mesmo devolveria 403 a cada
abertura da tela.

Esconder botão não substitui autorização: o servidor recusa de qualquer forma, e
foi verificado que recusa.

## Contratos usados

```
GET /inventory/balances        search businessUnitId catalogItemId lowStock page limit
GET /inventory/items/:id
GET /inventory/movements       search type businessUnitId catalogItemId
                               operationId source from to page limit
GET /inventory/analytics/summary      from to businessUnitId
GET /inventory/analytics/consumption  from to businessUnitId
POST /inventory/entries · /consumptions · /returns · /adjustments · /transfers
PUT  /inventory/minimums
GET /catalog/products?kind=&search=&status=ACTIVE
```

## Lacunas declaradas

| Lacuna | Situação |
| --- | --- |
| **Sem reserva manual** | o backend publica `reserved` e `available`, mas não há endpoint que reserve; ação declarada indisponível |
| **Sem nome da unidade contraparte** | o movimento de transferência publica só `counterpartUnitId`; o extrato da outra unidade mostra o outro lado com o nome dela |
| **Sem valor de estoque** | não há regra autoritativa de custo no contrato |
| **Sem transferência em trânsito** | a operação é atômica; a tela não simula estado intermediário |
| **Sem fornecedor, lote, série, validade, inventário físico, custeio e WMS** | fora do escopo do domínio |

## Verificado contra a API

42 verificações contra a API real, em organizações descartáveis:

entrada criando saldo com `balanceAfter`; os quatro números do saldo; consumo
reduzindo com vínculo à operação e direção resolvida pelo servidor; materiais da
operação por recorte server-side; devolução; ajuste sem motivo recusado (400);
ajustes de sobra e falta; **saldo insuficiente recusado com o disponível na
mensagem, e o saldo permanecendo íntegro depois**; `SERVICE` recusado nas duas
portas; transferência com as duas pontas e a mesma identidade; isolamento entre
unidades (10 e 6); mesma unidade recusada; `OK`, `LOW` e `OUT_OF_STOCK`; mínimo
sem mover saldo; filtro `lowStock`; paginação, filtros por tipo e unidade,
período invertido recusado; analytics com contagens reais e **nenhum campo
financeiro**; e a capability: com um plano que tem `catalog.read` e
`catalog.manage` mas não `inventory.*`, as sete rotas de estoque respondem 403
enquanto a listagem e o detalhe do item — com preço — continuam 200.
