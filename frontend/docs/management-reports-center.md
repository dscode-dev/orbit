# Management Reports Center (PR Frontend-23)

Onde se pergunta ao sistema como foi um período — e onde a resposta fica
guardada.

## Onde mora

`/relatorios`, item **Relatórios** no grupo Operação da navegação. Era o último
item marcado "em breve" na barra lateral; agora leva a uma tela.

## Três coisas com nomes parecidos, e elas não se misturam

| | O que é | Onde |
| --- | --- | --- |
| **Relatório de visita** | preenchido em campo, pertence a uma operação, assinado | `/api/v1/reports` — intocado por esta PR |
| **Documento emitido** | saída do Artifact Engine, com revisão, hash e revogação | Document Center (`/documentos`) |
| **Relatório gerencial** | retrato agregado de um período, sem dono operacional | **Reports Center** (`/relatorios`) |

O terceiro é o desta PR. Ele **não entra no Document Center**, e a razão não é
de interface: um relatório gerencial não tem `ArtifactExecution` nem
`ArtifactManifest` — não há execução que o tenha originado, não há revisão para
comparar e não há o que revogar. Colocá-lo lá porque também produz PDF faria a
central de documentos responder por algo que o Artifact Engine não emitiu.

## Dashboard × Relatório, dito na tela

A distinção aparece na Visão Geral, lado a lado, porque é a confusão mais
provável:

- **Dashboard** — situação atual e acompanhamento contínuo. Os números mudam
  sozinhos, porque a operação continua acontecendo.
- **Relatório gerencial** — fotografia de um período, com hash da fonte e
  procedência de cada número. Não muda depois.

Um relatório não é o painel exportado, e a tela não o apresenta assim.

## As três abas

**Visão geral** — quatro indicadores (`gerados`, `em composição`, `prontos`,
`falharam`), os cinco últimos relatórios, os tipos disponíveis e o acesso à
geração. Todos os números saem de `meta.total` de uma consulta com `limit: 1`:
**nada é contado no navegador**. Um indicador que mudasse conforme a paginação
seria pior que indicador nenhum.

**Gerar relatório** — o catálogo do servidor vira cartões; escolher um monta o
formulário com os parâmetros que **aquele tipo** declara aceitar.

**Histórico** — listagem paginada no servidor, com filtro por tipo, situação e
unidade.

## O catálogo manda

`GET /management-reports/catalog` publica tipo, nome, descrição, domínios,
parâmetros, formatos, janela máxima, capabilities e — já resolvido para a
sessão — `allowed` com `blockedReason`.

**Não existe lista de tipos escrita no cliente.** Um tipo novo do backend
aparece sozinho, um que saiu some sozinho, e um tipo desconhecido é renderizado
como qualquer outro: o cartão mostra o que ele declara e o formulário se monta a
partir dos parâmetros dele. Também não foi criado um "Reports Registry": o
catálogo do backend já é a autoridade, e um registry local seria a segunda
cópia que diverge primeiro.

Os formatos oferecidos são os publicados — **PDF e HTML**. Não há CSV nem XLSX,
porque o backend não os produz.

## Autorização composta

`reports.management.read` abre a área; **não abre os domínios**. O financeiro
exige `financial.read` além dela, e quem publica essa exigência por tipo é o
catálogo.

A tela **não recalcula** autorização: usa `allowed` e mostra `blockedReason`
escrito pelo servidor — "este relatório usa Financeiro, e seu acesso não inclui
Financeiro" é uma frase útil; um cartão que some sem explicação faz a pessoa
procurar um relatório que ela acha que existia.

Um 403 num relatório **não derruba o Reports Center**: cada aba tem
`TabBoundary` própria, e catálogo, histórico, detalhe e URL assinada são
consultas independentes. Na Visão Executiva, a seção que o ator não pode ver
vem **vazia com o motivo** — o backend a compõe assim, e a tela a exibe assim.

## Geração e acompanhamento

`POST` devolve **202** e uma solicitação `PENDING`. A tela navega para o
relatório e o acompanha com `GET /:id/status`, que para sozinho quando o
servidor termina (`pollWhile`, o mesmo mecanismo do Rendering Engine).

**Sem barra de progresso.** O backend publica quatro estados — `PENDING`,
`GENERATING`, `READY`, `FAILED` —, não porcentagem. Uma barra subindo seria um
número que ninguém mediu.

Enquanto compõe, o resto da aplicação continua utilizável: a espera é uma
consulta leve, não uma tela travada.

### Datas e fuso

As datas viajam como `YYYY-MM-DD`. O fuso é resolvido pelo **servidor**, a
partir da unidade de negócio, e volta no snapshot — a tela o exibe e não o
converte. Converter aqui faria o mesmo "outubro" começar em horas diferentes
conforme quem clicou.

Parâmetro que o tipo não aceita **não é enviado** (o formulário só monta o que
o catálogo declara), e o backend recusa com 400 se chegasse — as duas barreiras
concordam.

## O detalhe: geração × snapshot

A tela separa, explicitamente, duas coisas que se confundem:

- **A geração** — quem pediu, quando, período analisado, unidade, situação. A
  data da captura aparece marcada como tal, ao lado do período analisado: um
  relatório de março pode ter sido gerado em setembro.
- **O snapshot** — versão do formato, hash da fonte, fontes usadas, fontes
  **excluídas com o motivo**, e as seções com métricas e tabelas.

Nada é recalculado ao abrir. A tela não soma métricas, não cruza domínios e não
consulta o Analytics para "atualizar" um número antigo — se fizesse, o relatório
de março passaria a mostrar setembro e deixaria de ser prova de coisa alguma.

O valor de cada métrica é exibido **como veio**: texto, sempre. Nem `Number()`,
nem `toFixed`, nem separador recalculado — dinheiro é `Decimal` no servidor e
quantidade tem três casas, e foi ali que a formatação foi decidida.

## Procedência

`OBSERVED`, `DERIVED`, `PROXY` e `MOCK` aparecem **ao lado de cada número**, com
cor e explicação ao alcance do cursor. `PROXY` e `MOCK` recebem tom de atenção
de propósito: um valor aproximado precisa ser visivelmente diferente de um
medido, ou ninguém nota a diferença na hora de decidir.

As ausências conhecidas são exibidas como o backend as publica, sem preenchimento
local:

- **PMOC sem vencimento** — não há plano com periodicidade cadastrado;
- **cumprimento de prazo** é derivado do `scheduledEnd` da ordem, não de um
  contrato de SLA;
- **health score excluído** — depende do motor ambiental, cuja fonte é `MOCK`;
  aparece na lista de "fontes deixadas de fora", com o motivo.

## Preview e download

A URL é pedida ao backend (`GET /:id/download?operation=`) e usada **como
veio** — absoluta e assinada. O cliente não conhece bucket nem chave.

O ciclo de vida da assinatura é o **mesmo do Document Center**, e literalmente o
mesmo código: `useSignedUrlLifecycle` foi extraído de `useSignedUrl` quando o
segundo consumidor apareceu. Ele renova a URL antes de vencer usando o
`expiresAt` publicado, com margem, piso contra laço e `gcTime` acompanhando o
prazo — uma URL vencida não fica no cache esperando o primeiro clique falhar. A
tela mostra até quando a atual vale.

O `iframe` de visualização usa `sandbox` sem `allow-scripts`: o conteúdo é do
tenant e não roda na origem da aplicação.

## Registries

- **Entity Registry**: `management-report`, com rota própria (`href`), porque
  há navegação real para o detalhe — diferente da regra de automação, que abre
  em diálogo.
- **Action Registry**: `create`, `open`, `download` e `repeat`. A capability
  declarada é a **do motor**; a do domínio varia por tipo e quem a publica é o
  catálogo.
- **Metric Registry**: quatro contagens do próprio motor, para que rótulo,
  ícone e formato tenham um dono só.

`management-report.repeat` é **"gerar de novo", não "regenerar"**: não existe
rota que recomponha um relatório, e não deveria — o snapshot é imutável, e é
isso que o torna prova. A ação abre o gerador com o tipo pré-escolhido
(`?tipo=`); período e recorte são decisões de quem está pedindo agora.

## Contratos usados

| Endpoint | Onde |
| --- | --- |
| `GET /management-reports/catalog` | cartões, formulário e autorização por tipo |
| `GET /management-reports` | histórico e indicadores (`meta.total`) |
| `POST /management-reports` | geração (202) |
| `GET /management-reports/:id` | detalhe com snapshot |
| `GET /management-reports/:id/status` | acompanhamento |
| `GET /management-reports/:id/download` | URL assinada (preview e download) |

`management-reports` foi acrescentado à allowlist do BFF — verificado no
servidor rodando: responde 401 sem sessão, `reports` (o operacional) continua
respondendo 401 no mesmo proxy, e uma raiz não exposta responde 404.

## Lacunas declaradas

- **Sem CSV/XLSX** — o backend publica PDF e HTML; o contrato de renderização
  descreve seções e campos, não grade tabular.
- **Sem seletor de cliente na geração.** Alguns tipos declaram `customerId`,
  mas não há busca de cliente dentro do contrato de relatórios, e um campo para
  digitar identificador à mão não serviria a ninguém. O filtro existe na API e
  fica disponível para quando houver seletor.
- **Sem regenerar** — ver acima: cria-se outro relatório.
- **Sem excluir relatório** — o backend não publica rota, e o histórico é o
  registro de quem perguntou o quê.
- **Sem comparar dois relatórios na tela.** Os hashes permitem conferir se dois
  recortes iguais deram o mesmo resultado; uma tela de comparação lado a lado
  não existe.
- **Sem agendamento recorrente e sem envio por e-mail** — não há contrato.
- **Sem filtro por autor na interface.** A API aceita `generatedById`; falta um
  seletor de membro nesta tela, e o filtro não foi exposto pela metade.
- **Sem BI builder, SQL, fórmula do usuário ou dashboard configurável.**

## Validação

36 verificações contra a API real (`node validate-reports-ui.mjs`), todas
passando, cobrindo os 24 cenários: catálogo dinâmico com formatos e sem
CSV/XLSX; geração dos cinco tipos principais; período e janela máxima; filtro
por unidade; parâmetro não aceito recusado; 202 → acompanhamento → `READY` sem
porcentagem; preview, HTML e download por URL assinada **sem revelar caminho de
sistema**; reassinatura com novo prazo; histórico paginado e filtrado no
servidor; **snapshot imutável depois de novos dados**; hash publicado e igual
entre recortes idênticos; procedência em toda métrica; fontes excluídas com
motivo; seção indisponível com o texto do servidor; 403 no financeiro sem
`financial.read`; o 403 **não derrubando** catálogo, histórico nem os outros
sete tipos; executivo com a seção financeira declarada ausente; 403 sem
`reports.management.*` e 401 sem sessão; e `/api/v1/reports` operacional
continuando intacto e separado.

Mais: `tsc --noEmit`, `eslint .` (0 erros), `next build` com `/relatorios` e
`/relatorios/[id]`, e `git diff --check`.
