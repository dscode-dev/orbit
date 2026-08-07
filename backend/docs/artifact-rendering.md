# Artifact Rendering Engine

Transforma uma execução em documento e o registra no manifest.

---

## 1. Fronteira com a PR-19

O renderer **produz bytes**. Nada além disso.

| Responsabilidade         | Onde vive                                    |
| ------------------------ | -------------------------------------------- |
| Gerar conteúdo           | PR-20 — `ArtifactRenderer`                   |
| Guardar o arquivo        | PR-19 — `FileObjectService` / Storage Provider |
| Calcular o SHA-256       | PR-19 — sobre o conteúdo gravado             |
| Numerar a revisão        | PR-19 — sob advisory lock                    |
| Aposentar a anterior     | PR-19 — índice único parcial                 |
| Autorizar o download     | PR-19 — URL assinada                         |

`ArtifactRenderProcessor` chama `ArtifactManifestService.issueWithContent` e
não conhece bucket, chave, hash nem revisão. A única adição à PR-19 foi esse
método: o caminho em processo para quem já tem os bytes — o mesmo trabalho que
o caminho por URL assinada faz, sem o desvio pela rede.

## 2. Contrato do renderer

```ts
interface ArtifactRenderer {
  id: string;          // gravado em `manifest.renderer`
  version: string;     // gravado em `manifest.rendererVersion`
  format: string;
  mimeType: string;
  render(input: RenderInput): Promise<RenderOutput>;
}
```

O renderer é **puro**: mesma entrada, mesma saída, sem banco, sem arquivo, sem
rede. É o que torna "snapshot → documento" uma função testável, e não um
cenário de integração.

`ArtifactRenderAssembler` é o único lugar que conhece as duas formas — o JSON do
snapshot e o `RenderInput`. Ele ordena seções e campos, casa resposta com
campo, descarta assinatura revogada e lê o branding do layout.

### Registry

`ArtifactRendererRegistry` resolve o identificador para o motor. Um renderer
desconhecido é recusado **no pedido**, com a lista do que existe — um job que
morre em segundo plano por erro previsível é pior que um 400.

Registrar um motor novo é acrescentar um provider em
`artifact-rendering.module.ts`. Registry, pipeline, manifest e API não mudam.

## 3. HTML primeiro, e por quê

HTML é inspecionável, versionável em teste e serve de entrada para qualquer
motor de impressão futuro. O CSS já marca a **quebra lógica**
(`break-inside: avoid`), então o dia em que um Chromium consumir este HTML, a
página quebra onde o documento diz que pode.

Composição: cabeçalho com branding → seções → campos e respostas → assinaturas →
rodapé com código, versão do template, hash da estrutura e `correlationId`.

## 4. PDF: a avaliação do Chromium

O enunciado pede para avaliar Chromium/Puppeteer. A avaliação:

| Critério              | Chromium/Puppeteer                  | pdfkit (adotado)        |
| --------------------- | ----------------------------------- | ----------------------- |
| Fidelidade ao HTML    | total                               | reimplementa o layout   |
| Peso na imagem        | +300 MB e bibliotecas de sistema    | zero — já é dependência |
| Superfície de ataque  | navegador completo no servidor      | biblioteca de desenho   |
| Isolamento necessário | sandbox, limite de memória, timeout | nenhum                  |
| Já em uso no Orbit    | não                                 | sim (`document-engine`) |

**Escolha: pdfkit.** Já é dependência do projeto e já gera os documentos do
Document Engine. Trazer um navegador para o contêiner da API é decisão de
infraestrutura com custo operacional real, e a fidelidade a CSS complexo que
ela compra não é necessária para estes artefatos, que são tabulares.

**A troca continua barata.** `pdf.chromium` entra como provider novo, consome
`ArtifactHtmlRenderer.document()` e nada mais muda. É por isso que o HTML veio
primeiro.

## 5. Pipeline assíncrono

```
POST /render ──▶ valida ──▶ PENDING ──▶ enfileira ──▶ 202
                                            │
   worker ──▶ RENDERING ──▶ renderer ──▶ manifest (PR-19) ──▶ READY
                                            │
                                    esgotou tentativas ──▶ FAILED
```

### A fila: por que Postgres

**O Orbit não adotou mensageria.** Não há Redis, BullMQ, RabbitMQ nem Kafka —
só Postgres e Socket.IO. O enunciado pede para não criar infraestrutura
paralela *se já existir mecanismo reutilizável*; como não existia, a escolha foi
entre acrescentar um componente ao deploy ou usar o que já está lá.

`FOR UPDATE SKIP LOCKED` entrega o que a PR exige — exclusão mútua entre
réplicas, idempotência, retry, backoff, dead-letter — sem um serviço novo para
operar, monitorar e proteger.

O limite honesto: atende dezenas de jobs por segundo, não milhares. Se o volume
exigir, trocar `BackgroundJobQueue` por uma fila dedicada não toca nenhum
processador.

A tabela `background_jobs` é **genérica**: renderização é o primeiro uso.

### Idempotência

Índice único parcial sobre `(queue, job_key)` enquanto o status é `PENDING` ou
`RUNNING`. Pedir renderização duas vezes devolve **o mesmo job** — a garantia é
do banco, não de uma checagem no código. Verificado no E2E.

Reexecução (processo derrubado, job devolvido por tempo limite) é segura: a
revisão é aberta pelo **processador**, então uma segunda passagem abre a
revisão seguinte em vez de reemitir na mesma — e a política do manifest recusa
emitir duas vezes no mesmo registro.

### Retry e backoff

Exponencial com teto: 5s, 10s, 20s, 40s… até 5 minutos. Esgotadas as
tentativas, o job vai para `DEAD` — o dead-letter desta fila, que permanece na
tabela com o último erro.

`PermanentJobError` pula o retry: payload malformado ou execução removida não
melhoram na terceira tentativa.

Jobs `RUNNING` há mais de 5 minutos são devolvidos à fila.

### RLS no trabalho de fundo

O ponto delicado. O worker não atende requisição, então não há
`RequestContext` — e sem ele a `RlsTransaction` não sabe qual organização
declarar.

A solução **não** é rodar como administrador da plataforma: isso desligaria o
isolamento justamente no caminho que roda sem ninguém olhando. O job carrega
organização, unidade e ator, e o worker reabre esse contexto com
`RequestContextStorage.run`. A política do banco é a mesma da requisição.

O worker **não herda papéis nem permissões**: autorização já aconteceu no
pedido, e repeti-la com um papel congelado no tempo seria pior — um papel
revogado continuaria valendo. O que ele declara é o escopo de dados.

## 6. Estados

| Estado         | Significado                                   |
| -------------- | --------------------------------------------- |
| `NOT_RENDERED` | nunca foi pedido                              |
| `PENDING`      | pedido e enfileirado                          |
| `RENDERING`    | o worker está produzindo                      |
| `READY`        | documento emitido; o manifest ativo tem o arquivo |
| `FAILED`       | tentativas esgotadas; `error` diz o motivo    |

**O backend é a autoridade.** Nenhuma rota aceita `renderStatus` como entrada.

`FAILED` só aparece na **última** tentativa: enquanto há retry pela frente o
estado continua `RENDERING`. Dizer que falhou e depois voltar a `READY` seria
mentir duas vezes.

## 7. Segurança

| Camada       | O que faz                                                   |
| ------------ | ----------------------------------------------------------- |
| RLS          | isolamento por organização e unidade, também no worker      |
| Capability   | `artifact_rendering.render` para pedir                      |
| RBAC         | `artifact_rendering.render` no papel                        |
| Plano ativo  | `@RequiresActivePlan()` como no resto da plataforma         |
| Auditoria    | `ARTIFACT_RENDER_REQUESTED` e `ARTIFACT_RENDER_COMPLETED`   |
| Sanitização  | todo valor escapado antes de virar marcação                 |

### Templates e respostas nunca executam script

**Não existe caminho de HTML confiável.** `escapeHtml` é aplicado a todo valor —
rótulo, título, resposta, unidade, nome de quem assina, nome da organização.
Não há `innerHTML`, não há modo "confie neste campo".

Escapar em vez de limpar é deliberado: um sanitizador decide o que é permitido,
e a lista de permissões é onde os bypasses moram. Escapar não decide nada.

Complementos: o documento declara `Content-Security-Policy: default-src 'none'`
para o caso de ser aberto direto no navegador, e cor de branding só é aceita em
hexadecimal — cor livre abriria `url(javascript:…)` dentro do estilo.

Sete testes cobrem isso, incluindo marcação vinda do template, da resposta, do
branding e do nome de quem assina.

### Erro sem vazamento

O que é gravado em `renderError` e devolvido ao cliente é mensagem de negócio.
Stack, caminho e credencial ficam no log do worker, com o mesmo
`correlationId`.

## 8. Observabilidade

Contadores por processo — iniciadas, concluídas, falhas, retries, duração
acumulada e média, bytes acumulados e média, tudo também por renderer — em
`GET /artifact-rendering/metrics`.

**São do processo, não da plataforma**: reiniciam com ele e não somam entre
réplicas. Está dito no Read Model.

O Orbit não adotou Prometheus nem OpenTelemetry; trazer um cliente agora
significaria decidir endpoint de scrape, formato e retenção — decisão maior que
esta PR. O que existe no lugar é **uma linha estruturada por evento** no log
(`event: render.started|succeeded|failed|retried`), que um coletor lê sem
mudança de código.

`correlationId` atravessa pedido, job, log, auditoria, metadados do manifest e
o rodapé do documento.

## 9. API

```
POST /api/v1/artifact-executions/:id/render   202  solicita
GET  /api/v1/artifact-executions/:id/render   200  consulta o estado
GET  /api/v1/artifact-rendering/metrics       200  contadores
```

**Só isto.** Listar revisões e obter URL de download já existem na PR-19;
repeti-los criaria dois caminhos para a mesma coisa. Nenhuma rota devolve
arquivo bruto — quando uma URL assinada resolve, é ela que é devolvida.

`202` e não `201`: nada foi criado ainda, o trabalho foi aceito.

## 10. Verificação

```
unitários   172 testes · 45 suítes
  · HTML: composição, ordem, ausência, campo oculto, quebra lógica
  · HTML: 7 testes de sanitização (template, resposta, branding, assinante)
  · PDF: PDF válido, texto escrito (stream inflado e hex decodificado),
         metadados do renderer, múltiplas páginas
  · backoff: curva, teto, retry × dead-letter, erro permanente
E2E         9 testes do ciclo completo
  · NOT_RENDERED inicial
  · renderer desconhecido recusado antes de enfileirar (400 com a lista)
  · POST devolve 202 sem esperar
  · pedir duas vezes devolve o mesmo job
  · worker renderiza → manifest ISSUED → renderStatus READY
  · o PDF no storage tem o hash publicado
  · segunda renderização → revisão 2, revisão 1 SUPERSEDED, uma ativa
  · métricas publicadas
  · sem sessão → 401
build       nest build              sem erros
lint        eslint                  sem erros
flutter     analyze + 81 testes     sem problemas
```

## 11. Limitações e próximos passos

| Limitação                          | Situação                                                     |
| ---------------------------------- | ------------------------------------------------------------ |
| **DOCX**                           | não implementado; é um `ArtifactRenderer` novo               |
| **PDF/A**                          | pdfkit não emite perfil de arquivamento; exigiria outro motor |
| **Assinatura digital do PDF**      | `contentHash` é o valor que ela cobrirá; falta o certificado |
| **Chromium/Puppeteer**             | avaliado e não adotado (§4); entra como provider             |
| **Fidelidade HTML → PDF**          | as duas saídas vêm do mesmo modelo, não uma da outra         |
| **Fila dedicada**                  | Postgres atende o volume atual; a troca é de uma classe      |
| **Métricas agregadas**             | por processo; o log estruturado é a fonte para um coletor    |
| **Cancelar renderização em curso** | não há endpoint; o job termina e a revisão seguinte corrige  |
| **Reprocessar job morto**          | `DEAD` permanece na tabela; falta a rota de reenfileirar     |
| **Imagens e anexos no documento**  | anexos não são embutidos; o documento os referencia por texto |
| **Cabeçalho/rodapé por página no HTML** | HTML não tem página; só o PDF numera                    |
