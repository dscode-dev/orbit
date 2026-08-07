# Customer & Equipment Workspace

A consolidação Cliente → Equipamentos.

|            |                                                        |
| ---------- | ------------------------------------------------------ |
| Rotas      | `/clientes`, `/clientes/:id`, `/ativos`, `/ativos/:id` |
| Capability | `crm.read` · `assets.read`                             |
| Registries | Entity · Action · Metric · Document · Navigation       |

---

## 1. A decisão

O parque instalado deixou de ser um módulo paralelo. Quem contrata o serviço é
o cliente; os equipamentos são dele, e é a partir dele que se chega a eles.

**"Equipamentos" saiu do menu principal** e virou uma aba do Customer
Workspace. A rota individual continua existindo — deep link, QR Code lido em
campo e navegação contextual dependem dela.

### `asset` continua sendo `asset`

O nome técnico não mudou, e não devia mudar: é o recurso (`/assets`), a
capability (`assets.read`), o filtro que três outros contratos aceitam
(`?assetId=`) e o `EntityId` interno. Renomear por motivo visual quebraria
tudo isso sem ganho.

O que mudou é o que o usuário lê: **Equipamento**. É o vocabulário do HVAC-R e
o que a operação de campo manuseia. A tradução vive num lugar só — o Entity
Registry:

```ts
id: "asset",
label: "Equipamento",
labelPlural: "Equipamentos",
```

Título, menu, trilha, estados vazios e a paleta de comandos leem de lá.

### A rota permanece `/ativos`

Renomeá-la para `/equipamentos` quebraria links salvos e QR Codes já impressos,
sem ganho — o usuário lê "Equipamentos" porque é o que o registry publica, não
porque a URL diz isso.

`/ativos` (listagem geral) permanece por três motivos concretos:

- **deep link** — links salvos continuam funcionando;
- **destino de fallback** — `customerId` é opcional no contrato, e um
  equipamento sem cliente não teria para onde voltar;
- **paleta de comandos** — ⌘K ainda leva à visão do parque inteiro, que é
  legítima quando a pergunta é sobre a frota e não sobre um contrato.

## 2. Customer Workspace V2

Seis abas, cada uma com consulta e **Error Boundary próprios**
(`TabBoundary`). As fontes são de módulos diferentes com capabilities
diferentes: sem `assets.read`, a aba de equipamentos declara a ausência e as
outras seguem funcionando.

| Aba              | Fonte                                  | Conteúdo                                                      |
| ---------------- | -------------------------------------- | ------------------------------------------------------------- |
| **Visão geral**  | `GET /customers/:id` + agenda + IA     | dados, contatos, endereço, indicadores, próximos compromissos |
| **Equipamentos** | `GET /assets?customerId=`              | listar, criar, editar, ativar/desativar, QR Code              |
| **Operações**    | `GET /operations?customerId=`          | status, equipe, agendamento, ida ao Operations Workspace      |
| **Execuções**    | `GET /artifact-executions?customerId=` | progresso, status, responsável, ida ao Execution Workspace    |
| **Documentos**   | `GET /artifact-executions?customerId=` | preview, revisões, download — via `DocumentViewer`            |
| **Histórico**    | —                                      | ausência declarada (§5)                                       |

As contagens nos crachás vêm de `counts` do próprio `GET /customers/:id`,
calculadas no banco. Nada é somado na tela.

### Equipamentos: o que é real

Verificado contra a API:

```
POST /assets                       201 · nasce vinculado ao cliente
GET  /assets?customerId=           200 · filtro do servidor, total 1
GET  /assets/resolve/ORB-0D5AD90D  200 · Chiller 120TR
GET  /assets/resolve/NAO-EXISTE    404 · "não há esse identificador"
PATCH /assets/:id {status:INACTIVE} 200 · INACTIVE
PATCH /assets/:id {status:ACTIVE}   200 · ACTIVE
POST /assets {status:...}          400 · property status should not exist
```

A última linha é a razão de o formulário **não** oferecer status na criação:
`CreateAssetDto` não tem o campo. Ativar e desativar existem depois, como ações
próprias do Action Registry (`asset.activate` / `asset.deactivate`), ambas
`PATCH /assets/:id` com `status` — a única forma que o contrato oferece.

### QR Code

`GET /assets/resolve/:identifier` é o mesmo endpoint que o aplicativo de campo
usa. O diálogo aceita o **conteúdo** do código; a leitura óptica é do móvel,
que tem câmera e permissão. Um leitor no navegador seria uma segunda
implementação do mesmo contrato, com mais superfície de erro.

A busca só dispara no envio: resolver a cada tecla geraria uma consulta por
caractere, cada uma com um 404 legítimo.

## 3. Equipment Workspace

A rota individual permanece e passa a viver no contexto do cliente:

- **a volta é para o cliente** quando ele existe, e para a listagem geral
  quando não — o contrato permite `customerId` nulo;
- **ações reais** no cabeçalho: editar e ativar/desativar, ambas do Action
  Registry, ambas escondidas quando plano ou papel não as liberam;
- dados técnicos, identificador/QR Code, operações, agenda, execuções,
  documentos e indicadores continuam como estavam.

**IA não aparece**: `AiExecutionQueryDto` aceita `customerId`, não `assetId`.
O painel declara a ausência em vez de mostrar a IA da organização como se fosse
do equipamento.

## 4. Signed URL Lifecycle

`src/hooks/documents/use-signed-url.ts`

### O problema

A URL era pedida com `staleTime: 30_000` — um número sem relação com nada. O
prazo real vem do backend em `expiresAt`, e os dois não conversavam:

- **prazo maior que o `staleTime`**: reassinava a cada 30 s uma URL que ainda
  valeria minutos;
- **prazo menor que a permanência na tela**: o visualizador ficava aberto com
  uma URL vencida, e o próximo clique falhava sem explicação.

### A correção

```
emitida ─────────────────────────────┬──── margem 30s ────┬ expira
         reutiliza do cache          │   reassina aqui    │
```

`staleTime` e `refetchInterval` são **funções do dado**: leem `expiresAt` e
devolvem o tempo até a renovação. Medido na API: TTL de 300 s → refetch
agendado para ~270 s.

### Por que não entra em laço

1. **O intervalo vem da resposta**, não de uma constante — prazo longo agenda
   longe.
2. **Piso de 5 s.** Um `expiresAt` já vencido (relógio fora de sincronia,
   resposta lenta) agendaria `0` e giraria sem parar.
3. **`refetchIntervalInBackground: false`.** Aba escondida não reassina; ao
   voltar, `refetchOnWindowFocus` cuida.

### URL vencida não fica no cache

`gcTime` acompanha a margem: assim que a URL não serve e ninguém a observa, ela
sai da memória. Sem isso, reabrir uma revisão visitada há uma hora entregaria a
URL antiga antes de qualquer refetch.

### Mesma infraestrutura em preview e download

São a mesma assinatura sobre o mesmo objeto; o que muda é o
`Content-Disposition` que o **backend** decide. A operação entra na query key,
então as duas coexistem sem uma sobrescrever a outra. Verificado: reassinar
devolve um `expiresAt` novo.

O Storage Provider não foi tocado.

## 5. Query Layer

As abas reutilizam as **mesmas chaves** dos módulos donos:
`assetsService.keys.list({ customerId, … })` é a mesma key que a listagem geral
produziria com aquele filtro. Duas telas pedindo o mesmo recorte compartilham
uma consulta — o TanStack Query deduplica.

O escopo entra na key naturalmente: `customerId` e `assetId` são parâmetros da
consulta; `businessUnitId` entra quando a tela o informa. Trocar de unidade ou
de organização descarta tudo (`RequestContextProvider.discardScopedQueries`),
então escopo não vaza entre tenants.

Uma aba só monta quando aberta: abrir o cliente não dispara as seis consultas.

## 6. Endpoints utilizados

| Endpoint                                 | Uso                                   |
| ---------------------------------------- | ------------------------------------- |
| `GET /customers/:id`                     | dados, contatos, endereço, `counts`   |
| `GET /assets?customerId=`                | aba Equipamentos                      |
| `POST /assets`                           | criar equipamento                     |
| `PATCH /assets/:id`                      | editar · ativar · desativar           |
| `GET /assets/resolve/:identifier`        | QR Code, etiqueta, NFC                |
| `GET /assets/:id`                        | Equipment Workspace                   |
| `GET /operations?customerId=`            | aba Operações                         |
| `GET /artifact-executions?customerId=`   | abas Execuções e Documentos           |
| `GET /scheduling/events?customerId=`     | próximos compromissos                 |
| `GET /ai-executions?customerId=`         | Orbit Intelligence do cliente         |
| `GET /artifact-executions/:id/manifests` | revisões, na aba Documentos           |
| `GET /artifact-manifests/:id/download`   | URL assinada                          |
| `GET /organizations/current/members`     | nome do responsável (`UserReference`) |

## 7. Lacunas do backend

| Lacuna                                                              | Consequência                                     |
| ------------------------------------------------------------------- | ------------------------------------------------ |
| **Sem histórico de cliente ou equipamento**                         | aba declara a ausência (§8)                      |
| Sem listagem de manifests por cliente                               | a aba Documentos parte das execuções             |
| `AiExecutionQueryDto` não aceita `assetId`                          | sem IA no Equipment Workspace                    |
| `ArtifactExecutionListItemReadModel` publica só `responsibleUserId` | o nome vem de `/organizations/current/members`   |
| Sem índice de saúde por equipamento                                 | `GET /analytics/health` é da organização/unidade |
| Sem criticidade no modelo `Asset`                                   | não há campo nem filtro                          |
| `CreateAssetDto` sem `status`                                       | o formulário não o oferece na criação            |
| Plano STARTER sem `business_units.read`                             | a unidade vem das claims do token                |

## 8. Histórico: a ausência, declarada

`AuditLog` existe no banco com exatamente a forma necessária — `entityType`,
`entityId`, `action`, `before`, `after`, `userId`, `createdAt` — e até um
`@@index([entityType, entityId, createdAt])`. Os repositórios de artefato,
manifest e renderização já escrevem nele.

**Nenhum endpoint o publica para um tenant.** Verificado:

```
GET /customers/:id/history  404
GET /assets/:id/history     404
GET /audit-logs             404
```

A tela **não reconstrói**. Daria para montar uma linha do tempo juntando
`createdAt`/`updatedAt` das listas já carregadas — seria uma invenção: mostraria
"cliente atualizado" sem saber o que mudou, quem mudou ou por quê, e omitiria
tudo que não passa por aquelas quatro listas. Uma linha do tempo incompleta que
parece completa é pior que nenhuma.

O que existe de datado está nas abas, cada registro com a sua data.

## 9. Nenhuma regra de negócio no frontend

- não decide status inicial de equipamento — o DTO nem aceita o campo;
- não pré-verifica unicidade de identificador — o `@@unique` é do banco;
- não interpreta `specifications`, que é JSON livre do tenant;
- não filtra por cliente na tela — `customerId` é filtro do servidor;
- não soma contagens — `counts` vem calculado;
- não autoriza — permissões e capabilities são as que o backend exige.
