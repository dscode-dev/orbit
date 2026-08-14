# Management Reports & Insights Engine (PR-25)

O que aconteceu num período, congelado no momento em que alguém perguntou.

## Dashboard × Report

| | Dashboard | Report |
| --- | --- | --- |
| Pergunta | como está **agora** | o que aconteceu **entre duas datas** |
| Vida útil | segundos | anos |
| Recalcula | a cada abertura | **nunca** |
| Prova | nenhuma | hash da fonte, parâmetros, autor, instante |

Um relatório não é uma captura de tela do dashboard. O dashboard responde
"quantas ordens estão abertas"; o relatório responde "quantas foram abertas em
março", e continua respondendo isso em setembro — mesmo que março tenha ganhado
lançamentos retroativos desde então.

É por isso que o snapshot é gravado: um número que muda quando se olha de novo
não serve para levar a uma reunião.

## A forma

```
tipo + parâmetros ──▶ providers ──▶ seções ──▶ snapshot + hash
                                                     │
                                        renderer ──▶ storage ──▶ READY
```

`POST` devolve **202** e uma solicitação `PENDING`; a composição roda na fila.
Compor um ano de seis domínios e desenhar um PDF não cabe no tempo de uma
requisição HTTP, e segurar a conexão daria tempo limite no primeiro relatório
anual.

## Onde ele mora, e por que não em `/reports`

`/api/v1/management-reports`, com `reports.management.read` e
`reports.management.manage`.

`/reports` já existe: é o **relatório operacional de visita** (PR-08/09) —
pertence a uma operação, tem seções preenchidas em campo e coleta assinatura.
Duas razões para não ocupá-lo:

1. **Contrato.** A rota e as capabilities `reports.read`/`manage`/`render` já
   têm dono e semântica.
2. **Autorização.** Reaproveitar `reports.read` faria quem lê o relatório de
   uma visita ler o relatório gerencial **financeiro** da organização. É
   exatamente o contorno que um motor que agrega tudo precisa impedir.

A tabela também é nova (`management_reports`): um relatório gerencial não tem
operação, não é preenchido e não é assinado — compartilhar `reports` deixaria
metade das colunas nulas.

## Catálogo

Oito tipos, fechados e versionados. Não há criação por consulta, fórmula ou
configuração: um relatório é código que alguém escreveu e revisou.

| Tipo | Domínios | Exige além de `reports.management.*` |
| --- | --- | --- |
| `EXECUTIVE_OVERVIEW` | seis domínios | `operations.read` |
| `OPERATIONS_PERFORMANCE` | Operações | `operations.read` |
| `SCHEDULING_SLA` | Agenda + Operações | `scheduling.read`, `operations.read` |
| `FINANCIAL_PERFORMANCE` | Financeiro | `financial.read` |
| `COMMERCIAL_PERFORMANCE` | Comercial | `quotes.read` |
| `INVENTORY_CONSUMPTION` | Estoque | `inventory.read` |
| `PMOC_COMPLIANCE` | Documentos | `artifact_executions.read` |
| `DOCUMENTS_EXECUTIONS` | Documentos | `artifact_executions.read` |

`GET /management-reports/catalog` publica tipo, nome, descrição, parâmetros,
domínios, capabilities, permissões, formatos, janela máxima **e** `allowed`
para a sessão — com `blockedReason` em texto. É o que permite o Reports Center
montar a tela sem reimplementar autorização; a interface exibe o motivo, não o
adivinha.

## Autorização composta, e ela fecha

`reports.management.read` abre o motor; **não abre os domínios**. O relatório
financeiro exige `financial.read` — do plano **e** do papel — antes de compor
qualquer coisa, e a mesma checagem se repete na leitura do detalhe, do snapshot
e do download: quem perde o acesso ao Financeiro para de ler o relatório
financeiro que ele mesmo gerou.

Na **Visão Executiva** a regra é outra, de propósito: cada domínio entra se o
ator puder consultá-lo, e o que não entra vira **seção vazia com o motivo
escrito** e uma entrada `included: false` em `sources`. Recusar o relatório
inteiro por causa de uma seção transformaria acesso parcial em nenhum acesso;
esconder a seção produziria um relatório que parece completo.

A autorização do **momento do pedido** viaja no job. O conteúdo não depende de
quando o worker acordou nem de o papel do solicitante ter mudado no intervalo.

## Parâmetros

`dateFrom`, `dateTo` e, quando o tipo declara: `businessUnitId`, `customerId`,
`operationKind`, `operationStatus`.

Parâmetro que o tipo **não** aceita é recusado com 400, não descartado:
descartar em silêncio produziria um relatório da organização inteira para quem
pediu o de um cliente, e o snapshot não teria como dizer isso.

A janela máxima é declarada por tipo (400 dias) e a recusa diz o limite — não
trunca, que faria o relatório mentir sobre o período que cobre.

### Fuso

Resolvido **no servidor**: da unidade quando há uma, da matriz quando o
relatório é da organização inteira. Não existe parâmetro de fuso, e o navegador
não participa — dois relatórios do mesmo mês precisam cobrir o mesmo intervalo,
e "outubro" não pode começar em horas diferentes conforme quem clicou.

A quebra mensal acontece no banco, com `AT TIME ZONE`: uma operação concluída
às 22h de 31 de outubro em Recife cai em outubro, não em novembro.

## Providers e fontes

Um provider sabe um domínio e devolve seções. Não conhece PDF, storage, fila
nem os outros domínios.

| Domínio | Fonte | Como |
| --- | --- | --- |
| Financeiro | `FinancialService.summary/byCategory/timeline` | **reusado inteiro** |
| Estoque | `InventoryService.summary/consumptionByItem` | **reusado inteiro** |
| Operações | `operations` | agregação SQL nesta PR |
| Agenda | `scheduling_events` | agregação SQL nesta PR |
| Comercial | `quotes` | agregação SQL nesta PR |
| Documentos / PMOC | `artifact_executions` + `artifact_manifests` | agregação SQL nesta PR |
| Equipe | `operations` + `operation_users` | agregação SQL nesta PR |

Financeiro e Estoque **não são recalculados**: eles já sabem o que é lançamento
cancelado, qual é a moeda padrão, o que é "estoque baixo" e como a quantidade é
arredondada. Um segundo total discordaria do primeiro no primeiro caso de
borda, e ninguém confiaria em nenhum dos dois.

O que foi agregado aqui é o que **não tinha dono**: contagem de operações por
situação, de propostas por evento, de execuções por tipo, de carga por técnico.
O Commercial é o caso explícito — o funil com valor era lacuna declarada no
manifesto de contratos, e a agregação é feita no servidor, em SQL.

### Somar é trabalho do banco

Nenhuma consulta traz linha de domínio para a memória. Tudo é `COUNT`/`SUM` com
`FILTER`, agrupado no Postgres. `operationTotals` faz seis contagens numa
varredura só — seis consultas separadas leriam a mesma faixa seis vezes.

Dois índices foram acrescentados a `operations` (`organization_id, created_at`
e `organization_id, completed_at` parcial), com a justificativa na migração:
nenhum índice existente servia a "tudo da organização entre duas datas", que é
a consulta que todo relatório operacional faz.

## Proveniência

Todo número carrega `source` e `provenance` (`OBSERVED` · `DERIVED` · `PROXY` ·
`MOCK`), e o snapshot carrega a lista de fontes usadas — inclusive as **não**
usadas, com o motivo.

Nenhum número de relatório gerencial é `MOCK`. O *health score* do Analytics
ficou **de fora por decisão**: ele é o indicador consolidado da plataforma, mas
depende do motor ambiental, cuja fonte é declaradamente simulada. Um relatório
impresso e levado a uma reunião não é lugar para um número derivado de dado
simulado — e a exclusão fica registrada em `sources`, não escondida.

`DERIVED` é usado onde há conta sobre o observado: taxa de aprovação,
cumprimento de prazo, taxa de conclusão. Percentual com denominador zero
**não é publicado** — "0%" de nada afirma um desempenho que ninguém teve.

### O que "cumprimento de prazo" é, e o que não é

`completed_at <= scheduled_end`, a mesma régua do `KpiEngine`. **Não existe
acordo de nível de serviço cadastrado no Orbit** — não há entidade de SLA com
prazo por contrato ou por tipo. O que se mede é o prazo previsto na própria
ordem, a métrica sai `DERIVED` e a nota diz isso. Operações sem prazo previsto
não entram no denominador: contá-las como cumpridas inflaria o número, e como
descumpridas puniria quem nunca prometeu data.

## O snapshot

```jsonc
{
  "schemaVersion": 1,
  "type": "OPERATIONS_PERFORMANCE",
  "period": { "from": "…", "to": "…", "timezone": "America/Recife" },
  "scope": { "organizationId": "…", "businessUnitId": null },
  "parameters": { "…": "…" },
  "sections": [{ "id": "…", "metrics": [], "tables": [] }],
  "sources": [{ "domain": "OPERATIONS", "provenance": "OBSERVED", "included": true }],
  "generatedAt": "…"
}
```

Uma forma só para os oito tipos: seções, e dentro delas métricas e tabelas.
Oito formatos obrigariam o cliente a conhecer oito e o renderizador a ter oito
caminhos.

Número viaja como **texto**, inclusive quantidade e dinheiro — mesma razão do
Financeiro e do Estoque: ponto flutuante é onde um centavo some.

`READY` só existe com snapshot: o `CHECK` de banco recusa a transição sem
`data`, `source_hash` e `generated_at`, e a gravação é uma instrução só.

## Hash e reprodutibilidade

`sourceHash` é o SHA-256 do snapshot **sem o instante de geração**, com
serialização canônica (chaves ordenadas em qualquer profundidade).

- mesmos dados ⇒ mesmo hash, mesmo em gerações diferentes;
- número diferente ⇒ hash diferente;
- ordem dos campos no código ⇒ **não** muda o hash.

Incluir `generatedAt` faria todo relatório ter hash novo, e o hash deixaria de
dizer qualquer coisa sobre os números.

`parametersHash` é outra coisa: a identidade da **solicitação**, usada para
impedir geração duplicada.

## Idempotência e concorrência

Duas defesas, as duas no banco:

1. **Uma geração em andamento por recorte.** Índice único parcial sobre
   `(organization_id, type, parameters_hash)` onde `status IN ('PENDING',
   'GENERATING')`. O segundo clique conflita e o serviço devolve a solicitação
   que já existe — sem segundo job, sem segundo PDF. Depois de pronto, gerar de
   novo é legítimo: é o que se faz quando os dados mudaram.

2. **Relatório pronto não é recomposto.** `claim` é um `UPDATE … WHERE status
   <> 'READY'`: reentrega da fila, job devolvido por tempo limite e retry
   convergem para um snapshot e um arquivo. Se recompusesse, os números de
   março mudariam sozinhos em maio.

Retry **antes** de ficar pronto recompõe do zero, e isso é correto: não havia
snapshot para preservar.

## Renderização

Reutiliza o Artifact Rendering Engine: `pdf.default` e `html.default`, os
mesmos motores que desenham os documentos de campo. **Não existe segundo
gerador de PDF** — o que esta PR acrescenta é o adaptador que traduz o snapshot
para o `RenderInput` que eles já consomem.

O arquivo vai para o Storage já existente (`FileObjectService`), no namespace
`reports`, com SHA-256 calculado sobre o que foi gravado. O download é URL
assinada e expirável, auditada — nunca um caminho de bucket.

### O que **não** foi reutilizado: o Manifest

`ArtifactManifest` exige `executionId`, `snapshotId` e `templateId`, todos
obrigatórios e apontando para o Artifact Engine. Emitir um manifest para um
relatório exigiria fabricar uma execução de artefato por relatório — uma
mentira sobre o que uma execução é (um formulário preenchido por alguém em
campo) e poluição do Document Center com execuções que ninguém executou.

O que o manifest dá — imutabilidade, hash, versão, procedência — o snapshot já
dá, e para relatório é o que basta: não há revisão de relatório, porque não se
corrige um retrato; gera-se outro.

## Observabilidade

`correlationId` nasce no pedido e atravessa job, composição, renderização,
arquivo e auditoria. Os logs são estruturados: `report-generated` (tempo de
composição, tempo de renderização, bytes, seções, fontes usadas, hash,
tentativa), `report-failed` (motivo de negócio), `report-already-ready`.

Auditoria: `MANAGEMENT_REPORT_REQUESTED`, `MANAGEMENT_REPORT_GENERATED`,
`MANAGEMENT_REPORT_DOWNLOADED`.

Falha grava motivo **em linguagem de negócio** — sem stack, caminho de arquivo
ou SQL. O detalhe técnico fica no log, com o mesmo `correlationId`.

## Endpoints

| Método | Rota | Capability |
| --- | --- | --- |
| `GET` | `/management-reports/catalog` | `reports.management.read` |
| `GET` | `/management-reports` | `reports.management.read` |
| `POST` | `/management-reports` → **202** | `reports.management.manage` |
| `GET` | `/management-reports/:id` | `reports.management.read` + a do tipo |
| `GET` | `/management-reports/:id/status` | idem |
| `GET` | `/management-reports/:id/snapshot` | idem |
| `GET` | `/management-reports/:id/download` | idem |

Filtros da listagem: `type`, `status`, `businessUnitId`, `generatedById`,
`from`, `to` (data de **geração**), `page`, `limit`. Paginação no banco. A
listagem **não** carrega o snapshot: são páginas de JSON por linha.

## Limitações e lacunas declaradas

- **Sem PMOC vencido.** O Orbit não cadastra plano de PMOC com periodicidade e
  validade; o que existe é a execução do artefato do tipo PMOC. Derivar
  vencimento de "a última foi há mais de um ano" inventaria a periodicidade do
  cliente. A seção existe e declara a ausência.
- **Sem SLA contratual** — ver acima.
- **Sem CSV/XLSX.** O contrato de renderização (`RenderInput`) descreve seções
  e campos rótulo/valor, não grade tabular. Um CSV fiel exigiria um segundo
  contrato de saída e um renderizador tabular; nesta PR ficam PDF e HTML, pelo
  motor que já existe.
- **Tabela vira lista de campos no PDF**, pela mesma razão. Sai legível; não sai
  como grade.
- **Sem agendamento recorrente e sem envio por e-mail.** O Automation Engine
  poderá disparar geração no futuro — a fila já é a mesma —, mas nada disso
  entra aqui.
- **Sem BI builder, SQL customizado, fórmula do usuário, OLAP, data warehouse
  ou ETL.**
- **Sem ranking, nota ou score de funcionário.** O relatório de equipe publica
  atribuídas e concluídas, e diz que é volume: uma instalação de oito horas e
  uma visita de vinte minutos contam igual, e publicar a razão entre as duas
  colunas transformaria contagem em julgamento.
- **Sem valoração de estoque** — sem regra autoritativa de custo, qualquer
  total em dinheiro seria número inventado com aparência de contabilidade.
- **Sem comparação entre períodos** no mesmo relatório. Gera-se um por período;
  o hash permite compará-los fora.
- **Sem exclusão de relatório.** O histórico é o registro de quem perguntou o
  quê e quando; a coluna `deleted_at` existe para uma política futura de
  retenção, e nenhuma rota a escreve.

## Testes

- `report.composer.spec.ts` — 6 casos do hash: determinismo, independência do
  instante, sensibilidade a número, período e fuso, e imunidade à ordem das
  chaves.
- `report.provider.spec.ts` — 7 casos: autorização de provider (plano **e**
  papel), percentual sem denominador, seção indisponível com motivo.
- `report.service.spec.ts` — 13 casos: catálogo com `allowed`/`blockedReason`,
  recusa composta nos dois sentidos, período invertido, janela excedida, fuso
  da unidade, parâmetro não aceito, hash estável da solicitação, reuso da
  geração em andamento, autorização viajando no job, unidade fora do escopo.
- `test/management-reports.e2e-spec.ts` — 25 casos contra a aplicação montada,
  cobrindo os 24 cenários pedidos: catálogo; geração assíncrona até `READY` com
  PDF e snapshot; os quatro relatórios de domínio; período, unidade e fuso;
  **dados mudam depois e o relatório histórico não muda**; hash determinístico
  entre gerações; dois pedidos simultâneos produzindo um relatório e um
  arquivo; falha fechando como `FAILED` com motivo de negócio; isolamento entre
  organizações; filtro por unidade; **`reports.management.read` sem
  `financial.read` recusado, e o executivo saindo com a seção declarada
  ausente**; perda de acesso fechando a leitura de relatório antigo;
  proveniência em cada número e o indicador `MOCK` declarado como excluído;
  nenhuma métrica financeira no relatório de estoque; paginação e filtros;
  download por URL assinada; e nenhuma coluna de banco vazando na API.
