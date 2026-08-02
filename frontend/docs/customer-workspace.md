# Customer Workspace

Visão de 360° do cliente: cadastro, contatos, endereço, ativos, operações,
agenda, artefatos, indicadores e Orbit Intelligence.

|            |                                                                     |
| ---------- | ------------------------------------------------------------------- |
| Rotas      | `/clientes` (listagem) e `/clientes/[id]` (workspace)               |
| Capability | `crm.read` para abrir, `crm.manage` para escrever                   |
| Permissões | `customers.read` · `.create` · `.update` · `.delete` · `contacts.*` |
| Contratos  | literais sincronizados; a forma do cliente é **espelhada** (§6)     |

---

## 1. Endpoints utilizados

| Endpoint                                                                 | Uso                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------ |
| `GET /customers`                                                         | listagem, busca, filtros, paginação              |
| `GET /customers/:id`                                                     | cadastro, endereço, **contatos** e **contagens** |
| `PATCH /customers/:id`                                                   | edição                                           |
| `GET` · `POST` · `PATCH` · `DELETE /customers/:id/contacts[/:contactId]` | contatos                                         |
| `GET /assets?customerId=`                                                | ativos do cliente                                |
| `GET /operations?customerId=`                                            | operações                                        |
| `GET /scheduling/events?customerId=&from&to`                             | agenda futura                                    |
| `GET /artifact-executions?customerId=`                                   | artefatos executados                             |
| `GET /ai-executions?customerId=`                                         | **Orbit Intelligence**                           |

`customerId` é filtro real nos cinco contratos cruzados — verificado na API.
Todos os serviços já existiam; nenhum foi duplicado.

---

## 2. O primeiro Workspace com IA de escopo real

`AiExecutionQueryDto` aceita `customerId`. Isso torna o Customer Workspace **o
primeiro Workspace de entidade com fonte de Orbit Intelligence de verdade** — o
Asset Workspace teve de declarar ausência porque nenhum endpoint tem escopo de
equipamento.

`output` é JSON livre, definido pelo agente que executou. O painel lê as chaves
usuais (`summary`, `alerts`, `recommendations`, `opportunities`,
`observations`, `insights`) quando existem, e declara "formato não reconhecido"
quando não encontra nenhuma. Assumir estrutura quebraria no primeiro agente
diferente.

Sem a capability `ai.executions.read`, o painel declara a ausência em vez de
mostrar erro.

---

## 3. Indicadores: o backend já conta

O `include` do repositório de clientes traz:

```ts
_count: {
  select: {
    assets:     { where: { deletedAt: null } },
    operations: { where: { deletedAt: null } },
  },
}
```

São contagens feitas **no banco**, com o recorte de removidos aplicado pelo
servidor, publicadas no mesmo payload do detalhe. Nada é somado na tela — e
diferente do Asset Workspace, aqui nem foi preciso recorrer a `meta.total`.

A apresentação passa pelo Metric Registry, com definições registradas para
`customer.assets.total` e `customer.operations.total`.

**Fora do painel:** receita, ticket médio, tempo de resposta e inadimplência.
São indicadores legítimos de gestão de carteira e nenhum tem fonte — o Analytics
é escopado por unidade e período, não por cliente.

---

## 4. Filtros: o que o contrato aceita

`CustomerQueryDto` aceita `search`, `type`, `status`, `page` e `limit`. Nada
mais. Verificado:

```
GET /customers?city=Recife
→ 400  ['property city should not exist']
```

Por isso a tela **não** oferece os três filtros pedidos que não existem:

| Filtro pedido   | Por que não existe                                                                          |
| --------------- | ------------------------------------------------------------------------------------------- |
| **Unidade**     | o cliente é da organização; não há `businessUnitId` no modelo `Customer` — só o contato tem |
| **Cidade**      | mora em `address`, que é `Json?` sem esquema e sem índice                                   |
| **Responsável** | não existe campo de gestor de conta                                                         |

A cidade **aparece** como coluna, lida do `address` de cada registro — mostrar o
que veio é diferente de prometer filtrar por isso. A busca do servidor cobre
nome, nome fantasia, documento e e-mail.

---

## 5. Um componente, cinco entidades

O painel de registros relacionados subiu do Asset Workspace para
`src/entities/related-records.tsx` quando este Workspace precisou do mesmo
componente. Hoje **um componente** desenha ativos, operações, agendamentos e
execuções nos dois Workspaces, resolvendo ícone, cor, rótulo, rota e badge de
status pelo `EntityId`.

A entidade `customer` também deixou de ser "não navegável" no Entity Registry:
agora tem `href`, e todo `EntityLink` para cliente — inclusive o que já existia
no Asset Workspace — passou a navegar sem alteração naqueles arquivos.

---

## 6. Limitações encontradas no backend

| Limitação                                                                        | Consequência na tela                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Sem filtro por unidade, cidade ou responsável**                                | esses filtros não são oferecidos (§4)                                         |
| **Sem Read Model de cliente** — o controller devolve o registro do Prisma        | forma **espelhada** em `src/types/customers.ts`, com acesso tolerante         |
| **`address` é JSON sem esquema**                                                 | leitura tolerante; sem coordenadas, sem mapa                                  |
| **Sem campo de responsável pela conta**                                          | não há como exibir nem filtrar gestor                                         |
| **Sem histórico do cliente** — sem tabela de eventos e sem endpoint de auditoria | painel declara a ausência; os registros datados são os dos painéis de vínculo |
| **Analytics não aceita `customerId`**                                            | receita, ticket médio e tempo de resposta não têm fonte                       |
| **`deletedAt` é exposto no payload**                                             | campo interno vazando no contrato; a tela o ignora                            |
| Sem ordenação em `CustomerQueryDto`                                              | ordem do backend (`legalName asc`) declarada na tela                          |

---

## 7. Query Layer

**Sem atualização otimista.** `POST`/`PATCH /customers` podem ser recusados por
validação de documento (`IsDocument`) e por regra do servidor; antecipar
mostraria um estado que talvez seja rejeitado. As escritas **semeiam o cache
com a resposta** — o estado confirmado.

Contato é sub-recurso: criar, editar ou remover um contato muda o cliente (que
devolve `contacts` embutido), então essas escritas invalidam o detalhe.

---

## 8. Verificação contra a API real

```
criar cliente (CNPJ, endereço JSON)      ✓  payload traz contacts e _count
_count                                   ✓  { assets: 0, operations: 0 }
criar contato principal                  ✓
vincular ativo ao cliente                ✓  assets?customerId= → meta.total 1
operations?customerId=                   ✓
artifact-executions?customerId=          ✓
ai-executions?customerId=                ✓  fonte real de Orbit Intelligence
scheduling/events?customerId=            ✓
?city=Recife                             ✓  400 — o filtro não existe

tsc --noEmit  ·  eslint .  ·  next build ✓
Design System                            intacto
```

---

## 9. O que **não** foi implementado no frontend

- nenhum cálculo de métrica — as contagens vêm do `_count` do servidor;
- nenhuma reconstrução de relacionamento — `customerId` é filtro real nos cinco
  contratos;
- nenhum cálculo de disponibilidade, conflito ou recorrência;
- nenhum indicador derivado de artefatos;
- nenhuma geração de IA;
- nenhum componente novo no Design System.
