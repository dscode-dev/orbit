# Asset Workspace

Visão de 360° do equipamento: cadastro, identificação, operações, agenda,
artefatos executados e indicadores. Consome exclusivamente endpoints reais.

|            |                                                                   |
| ---------- | ----------------------------------------------------------------- |
| Rotas      | `/ativos` (listagem) e `/ativos/[id]` (workspace)                 |
| Capability | `assets.read` para abrir, `assets.manage` para escrever           |
| Permissões | `assets.read` · `.create` · `.update` · `.delete`                 |
| Contratos  | literais sincronizados; a forma do ativo é **espelhada** (ver §6) |

---

## 1. Endpoints utilizados

| Endpoint                                  | Uso                                                          |
| ----------------------------------------- | ------------------------------------------------------------ |
| `GET /assets`                             | listagem, busca, filtros, paginação                          |
| `GET /assets/:id`                         | cadastro, cliente, unidade, localização, identificação       |
| `GET /assets/resolve/:identifier`         | citado no painel de QR — é a rota que a leitura em campo usa |
| `PATCH /assets/:id`                       | edição (a escrita semeia o cache com a resposta)             |
| `GET /operations?assetId=`                | painel de operações e contador                               |
| `GET /scheduling/events?assetId=&from&to` | agenda futura, com recorrências expandidas                   |
| `GET /artifact-executions?assetId=`       | artefatos executados e contador                              |

Os três últimos reutilizam os serviços dos módulos donos — nenhum serviço foi
duplicado. `assetId` é filtro real nos três contratos, verificado na API.

---

## 2. Uma tela, cinco fontes independentes

```
GET /assets/:id                    ──> geral · cliente · localização · identificação
GET /operations?assetId=           ──> operações
GET /scheduling/events?assetId=    ──> agenda futura
GET /artifact-executions?assetId=  ──> artefatos
meta.total das consultas acima     ──> indicadores
```

Cada painel tem consulta própria e `PanelFrame` próprio, que já embute Error
Boundary local. Aqui isso pesa mais que nos Workspaces anteriores: as fontes são
de **módulos diferentes, com capabilities diferentes**. Quem não tem
`scheduling.read` recebe 403 apenas no painel de agenda — o resto da tela
continua utilizável, e o 403 aparece como ausência de acesso, não como falha.

---

## 3. Indicadores: de onde vêm os números

**Não existe analytics por ativo.** `AnalyticsQueryDto` aceita `from`, `to`,
`granularity` e `businessUnitId` — não `assetId`. Nenhum Read Model do módulo
Analytics descreve um equipamento.

O que existe de verdade é a **contagem que o servidor faz** ao responder uma
consulta filtrada: o `meta.total` de `GET /operations?assetId=…` e de
`GET /artifact-executions?assetId=…`. São contagens do banco, não somas feitas
na tela — a consulta pede `limit: 1` porque só o total interessa.

Esses números passam pelo **Metric Registry**, com definições registradas:

| Id                                | Origem                             |
| --------------------------------- | ---------------------------------- |
| `asset.operations.total`          | `meta.total` de operações do ativo |
| `asset.operations.open`           | idem, com `status=IN_PROGRESS`     |
| `asset.artifact_executions.total` | `meta.total` de execuções do ativo |

MTBF, disponibilidade, custo acumulado e tempo médio de reparo **não estão
aqui**: são indicadores legítimos de gestão de ativos e nenhum tem fonte.
Derivá-los das listas seria cálculo de métrica no cliente.

---

## 4. QR Code — e a única dependência nova

O painel de identificação codifica `asset.identifier`, que é exatamente o
payload que `GET /assets/resolve/:identifier` resolve de volta. O código colado
no equipamento leva a esta tela — é isso que dá sentido ao painel.

**`qrcode.react` é a única biblioteca externa acrescentada nesta PR.**
Justificativa: codificar um QR é um algoritmo fechado (Reed-Solomon, máscaras,
versões), não é regra de negócio nem apresentação que o Design System cubra, e
escrevê-lo à mão seriam centenas de linhas sem benefício. Roda **no navegador**,
sem serviço externo — nenhum dado do ativo sai da máquina para virar imagem.

Fica encapsulada em `identifier.section.tsx`; nenhum outro arquivo a importa.

Verificado na API: `GET /assets/resolve/ORBIT-ASSET-0091` devolve o ativo.

---

## 5. Navegação entre Workspaces

Toda navegação sai do **Entity Registry** — nenhum caminho literal, nenhum
`switch` de entidade. O painel de registros relacionados é um componente só,
usado três vezes com `EntityId` diferentes; ele resolve ícone, cor, rótulo,
rota e badge de status pelo registry.

Ver `docs/entity-registry.md`.

---

## 6. Limitações encontradas no backend

| Limitação                                                                                                                                                              | Consequência na tela                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Não existe `criticality`** — nem campo no modelo `Asset`, nem parâmetro em `AssetQueryDto`                                                                           | a coluna e o filtro de criticidade não são oferecidos; derivá-la de status ou de `specifications` seria inventar classificação           |
| **Sem índice de saúde por ativo** — `GET /analytics/health` é da organização/unidade                                                                                   | painel de saúde declara a ausência; atribuir o índice da operação ao equipamento seria falso                                             |
| **Sem histórico do ativo** — não há tabela de eventos nem endpoint de auditoria                                                                                        | painel de histórico declara a ausência; reconstruir a linha do tempo a partir de operações e execuções seria história montada no cliente |
| **Sem inteligência com escopo de ativo** — `/analytics/intelligence` é da organização, `/ai-executions` filtra por operação, insights de artefato pertencem à execução | painel de Orbit Intelligence declara a ausência em vez de reaproveitar dados de outro escopo                                             |
| **Sem Read Model de ativo** — o controller devolve o registro do Prisma com `include`                                                                                  | a forma é **espelhada** em `src/types/assets.ts`, com acesso tolerante a nulo; mudança no `include` quebra em runtime, não na compilação |
| **Sem coordenadas** — `location` é `VarChar(255)`                                                                                                                      | localização aparece como texto; não há mapa                                                                                              |
| **Sem ordenação** em `AssetQueryDto`                                                                                                                                   | a ordem do backend (`name asc, id asc`) é declarada na tela                                                                              |
| **"Em garantia" não é publicado**                                                                                                                                      | a data de garantia é exibida sem julgamento derivado do relógio do navegador                                                             |
| Analytics não aceita `assetId`                                                                                                                                         | ver §3                                                                                                                                   |

### A confirmação de que criticidade não existe

O `ValidationPipe` usa `forbidNonWhitelisted`, então um parâmetro inexistente é
recusado — o que serve de prova:

```
GET /assets?criticality=HIGH
→ 400  ['property criticality should not exist']
```

---

## 7. Atualização otimista

`PATCH /assets/:id` **pode ser recusado** por motivos que o cliente não enxerga:
identificador duplicado na organização (`@@unique([organizationId, identifier])`),
unidade ou cliente inexistentes. Antecipar o valor na tela mostraria um dado que
o servidor talvez rejeite, e teria de ser desfeito na frente do usuário.

Por isso a escrita **semeia o cache com a resposta** — o estado confirmado — em
vez de antecipar. É o que o contrato suporta: ele devolve o ativo atualizado, o
que já elimina a releitura.

---

## 8. Verificação contra a API real

```
criar ativo (chiller, QR, especificações)   ✓  ACTIVE · unidade embutida
GET /assets/resolve/ORBIT-ASSET-0091        ✓  resolve para o ativo
?search=Carrier                             ✓  1 resultado (fabricante)
?search=30XA                                ✓  1 resultado (modelo)
?category=EQUIPMENT · ?status=ACTIVE        ✓  1 resultado
?criticality=HIGH                           ✓  400 — o campo não existe
GET /operations?assetId=                    ✓  meta.total
GET /artifact-executions?assetId=           ✓  meta.total
GET /scheduling/events?assetId=             ✓  evento vinculado aparece
```

---

## 9. O que **não** foi implementado no frontend

- nenhum cálculo de métrica — os números vêm de `meta.total` do servidor;
- nenhuma classificação de criticidade — não existe no contrato;
- nenhum índice de saúde derivado;
- nenhuma linha do tempo reconstruída;
- nenhuma recomendação gerada localmente;
- nenhum componente novo no Design System.
