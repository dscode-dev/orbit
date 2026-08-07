# Catalog Workspace

Produtos, serviços e peças — a fonte oficial do catálogo.

|            |                                   |
| ---------- | --------------------------------- |
| Rota       | `/catalogo`                       |
| Capability | `catalog.read` · `catalog.manage` |
| Registries | Entity · Action · Metric          |

---

## 1. Stage 0 — o que o backend já tinha

O módulo `technical-catalogs` existe desde antes desta PR e é mais completo do
que o enunciado supunha:

| Recurso    | Endpoint                                    |
| ---------- | ------------------------------------------- |
| Itens      | `GET/POST/PATCH/DELETE /catalog/products`   |
| Categorias | `GET/POST/PATCH/DELETE /catalog/categories` |

`Product` traz `kind` (`PRODUCT` · `SERVICE` · `PART`), `sku`, `unit`,
`salePrice`, `costPrice`, `taxData`, `metadata`, `status`, categoria e unidade
de negócio. `ProductCategory` é hierárquica (`parentId`) e **serve produtos e
serviços ao mesmo tempo** — a centralização de categorias que a PR pede já
existia no contrato.

As capabilities `catalog.read` e `catalog.manage` já vinham no plano STARTER.

### Não há Catalog Registry

Um registry resolve "o que este identificador significa". Aqui não há
identificador a resolver: há uma entidade (`catalog-item`) no **Entity
Registry** e as suas ações no **Action Registry**. Criar um registry para dois
valores de `kind` seria cerimônia sem função.

### Uma entidade, não duas

Produtos e serviços são o **mesmo registro** — uma tabela, um endpoint, `kind`
distinguindo. Registrá-los como entidades separadas criaria dois donos para o
mesmo recurso, duas rotas para o mesmo detalhe e duas listas de ações
idênticas.

As abas existem porque quem cadastra pensa neles como coisas diferentes. O
contrato continua sendo um, e `kind` é filtro do **servidor**.

## 2. A alteração de backend, e por quê

**Uma só, e mínima.** `products.status` existia como coluna, era publicado no
Read Model (`"status": "ACTIVE"`) e era usado internamente
(`findAvailableProduct` exigia `ACTIVE`; `softDeleteProduct` gravava
`INACTIVE`) — mas **nenhum contrato o aceitava**:

```
PATCH /catalog/products/:id {status:"INACTIVE"}  400 property status should not exist
GET  /catalog/products?status=ACTIVE             400 property status should not exist
```

Sem isso, "ativar/desativar" — pedido explícito da PR — só seria possível pelo
`DELETE`, que é soft delete: some com o item das listagens. É a diferença entre
_"não oferecemos mais isto"_ e _"isto nunca existiu"_.

O que foi feito:

| Arquivo                       | Mudança                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `contracts/literals/index.ts` | `ProductStatus` (`ACTIVE` · `INACTIVE`) — formaliza os dois valores que o repositório já usava em texto |
| `catalog.dto.ts`              | `status?` opcional em `CatalogQueryDto` e `UpdateProductDto`                                            |
| `catalog.service.ts`          | repassa `status` no update                                                                              |
| `catalog.repository.ts`       | `status: query.status` no `where`                                                                       |

**Nenhum contrato existente mudou** — só campos opcionais foram acrescentados.
Sem migração, sem modelo novo, sem endpoint novo. Verificado:

```
PATCH status:INACTIVE   200 · status=INACTIVE · deletedAt=None  ← continua existindo
GET  ?status=ACTIVE     200 · total 2
GET  ?status=INACTIVE   200 · total 1
GET  sem filtro         200 · total 3  ← comportamento anterior preservado
POST com status         400 · property status should not exist  ← criação inalterada
```

`status` **não** entrou em `CreateProductDto`: o item nasce `ACTIVE` pelo
default do schema, e oferecer a escolha na criação sugeriria cadastrar algo já
indisponível.

## 3. As abas

| Aba              | Fonte                                | Conteúdo                                                                 |
| ---------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| **Produtos**     | `GET /catalog/products?kind=PRODUCT` | listar, criar, editar, disponibilizar/retirar, buscar, filtrar, detalhes |
| **Serviços**     | `?kind=SERVICE`                      | o mesmo, com unidade de cobrança e descrição em destaque                 |
| **Peças**        | `?kind=PART`                         | o mesmo; o contrato já as distingue                                      |
| **Categorias**   | `GET /catalog/categories`            | árvore hierárquica, compartilhada por todos os tipos                     |
| **Estoque**      | —                                    | ausência declarada (§5)                                                  |
| **Inteligência** | —                                    | ausência declarada (§5)                                                  |

Cada aba tem `TabBoundary` próprio: uma falha de renderização em Categorias não
derruba Produtos.

### Um componente para três abas

`CatalogItemsTab` recebe `kind` como prop. Escrever três listagens quase
idênticas seria a duplicação que o Workspace Core existe para evitar — busca,
filtros, paginação, contagem e estados vêm todos de `@/workspace`.

### Categorias: a árvore é montada na tela

O backend publica a lista plana com `parentId`; aninhar é **apresentação**, não
regra: nenhuma decisão, cálculo ou validação. Quem valida ciclos e dependências
é o servidor — verificado:

```
DELETE categoria com filhas  409 · Category with active children or products cannot be deleted
```

Categoria cujo pai não veio na lista aparece na raiz em vez de sumir: um
registro que existe precisa ser alcançável.

## 4. Preço nunca vira conta

`salePrice` e `costPrice` são `Decimal(14,2)` no banco e chegam como **string**
(`"100"`, `"89.9"`). É o correto — `number` perde precisão em dinheiro.

A conversão para `Number` acontece **só para formatar**, no último momento, e o
resultado nunca volta a ser usado em conta. Não há total, margem, imposto nem
"valor do catálogo": somar preços de itens com unidades diferentes não
significa nada, e quando existir Orçamento, quem multiplica quantidade por
preço é o servidor.

## 5. Lacunas do backend

| Lacuna                                                                                               | O que a tela faz                                                             |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Sem estoque** — nenhum modelo, coluna ou rota (`/catalog/stock`, `/stock`, `/inventory` → 404)     | a aba declara a ausência e mostra o recorte que _seria_ controlado           |
| **Sem duração de serviço** — `durationMinutes` → 400                                                 | o detalhe declara; unidade (`H`, `VISITA`) e descrição carregam a informação |
| **Sem Analytics de catálogo** — `AnalyticsDomain` não o cobre; `/analytics/kpis` nem aceita `domain` | KPIs são `meta.total` de consultas filtradas                                 |
| **Sem IA por item** — `AiExecutionQueryDto` não aceita `productId`                                   | aba declara a ausência                                                       |
| Sem fornecedor, NCM ou código de barras                                                              | não são oferecidos                                                           |
| Categorias sem paginação                                                                             | é adequado — a árvore precisa estar completa                                 |

### Por que a tela não estima estoque

Daria para derivar algo de `metadata` (JSON livre) ou de contagens de
operações. Seria invenção. Estoque errado não é um número impreciso — é uma
compra que não se faz, uma visita que sai sem a peça, um contrato que atrasa.

## 6. KPIs

Quatro contadores, cada um o `meta.total` de uma consulta com `limit: 1` —
contagem do banco, feita pelo servidor:

`catalog.products.total` · `catalog.services.total` · `catalog.parts.total` ·
`catalog.unavailable.total`

Registrados no **Metric Registry**, categoria `CONTRACTS` — a mais próxima do
que o catálogo é (aquilo que a organização se compromete a entregar). Não há
domínio de catálogo no contrato, e inventar um criaria vocabulário que o
backend não reconhece.

Nenhuma métrica artificial: sem valor agregado de preço, sem margem média, sem
"itens sem movimento" (que exigiria estoque).

## 7. Endpoints utilizados

| Endpoint                         | Uso                                             |
| -------------------------------- | ----------------------------------------------- |
| `GET /catalog/products`          | abas Produtos, Serviços, Peças · KPIs           |
| `GET /catalog/products/:id`      | detalhe                                         |
| `POST /catalog/products`         | criar item                                      |
| `PATCH /catalog/products/:id`    | editar · disponibilizar · retirar de circulação |
| `DELETE /catalog/products/:id`   | excluir (soft delete)                           |
| `GET /catalog/categories`        | aba Categorias · seletor dos formulários        |
| `POST /catalog/categories`       | criar categoria e subcategoria                  |
| `PATCH /catalog/categories/:id`  | editar categoria                                |
| `DELETE /catalog/categories/:id` | excluir categoria                               |

## 8. O catálogo como fonte oficial

Preço, descrição e unidade de medida vivem **aqui**. Nenhum outro módulo os
redeclara: quando outro contexto precisar de um item, o caminho é
`GET /catalog/products` com o filtro adequado — não uma cópia local.

### Integrações futuras, e o que já as prepara

| Consumidor              | O que já existe                                                                                 | O que falta no backend                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Operações**           | `catalogService.list({ kind: 'SERVICE' })`; o `ReferencePicker` da agenda é o padrão de seletor | `Operation` não tem itens; falta modelo de linha (`operationId`, `productId`, `quantity`) |
| **Artifact Studio**     | campo de artefato poderia referenciar um item pelo id                                           | `ArtifactFieldDto` não tem tipo de referência a catálogo                                  |
| **Execuções**           | idem                                                                                            | idem                                                                                      |
| **Customer Workspace**  | preço praticado por cliente seria um recorte do catálogo                                        | não há tabela de preço por cliente                                                        |
| **Orçamentos**          | itens, preços e unidades já publicados                                                          | não há modelo de orçamento                                                                |
| **Vendas / Financeiro** | `taxData` já existe como JSON livre por item                                                    | não há modelo fiscal nem de venda                                                         |

**O que esta PR fez para não atrapalhar:** o item é uma entidade só, com um
service só e uma key de cache só. Um consumidor futuro chama
`catalogService.list(...)` e recebe o mesmo objeto que o Workspace mostra —
sem tipo paralelo, sem segunda rota, sem cópia de preço. É a ausência de
acoplamento que se constrói agora; a funcionalidade vem quando o backend
publicar os modelos.

## 9. Nenhuma regra de negócio no frontend

- não decide disponibilidade inicial — o DTO nem aceita o campo na criação;
- não pré-verifica SKU duplicado — o `@@unique` é do banco, o 409 é do servidor;
- não valida ciclos de categoria nem dependências — 409 do servidor;
- não gera `slug` — é derivado do nome pelo backend;
- não calcula preço, margem, imposto ou total;
- não estima estoque;
- não filtra por tipo na tela — `kind` é filtro do servidor;
- não autoriza — permissões e capabilities são as que o backend exige.
