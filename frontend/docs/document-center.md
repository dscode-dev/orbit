# Document Center

A central documental — e o Document Registry que a sustenta.

|            |                                                     |
| ---------- | --------------------------------------------------- |
| Rota       | `/documentos`                                       |
| Capability | `artifact_manifests.read`                           |
| Registries | Document Registry · Template Type Registry · Entity |

---

## 1. O registry que a sustenta

Formato, renderizador, estado de renderização, visualizador e ações vêm do
**Document Registry** — que descreve _o documento emitido_, enquanto o Template
Type Registry descreve _o artefato_. Nenhum componente desta tela compara essas
coisas com string.

Detalhe do contrato, dos cinco estados e das ações: `docs/document-registry.md`.

## 2. De onde vem a lista

**Não existe listagem global de manifests.** O backend publica revisões sempre
sob uma execução (`GET /artifact-executions/:id/manifests`) — foi decisão
explícita da PR-19 de não criar endpoint administrativo.

A central parte de `GET /artifact-executions`, que desde a PR-20 carrega o
`renderStatus` real, e agrupa por esse estado. As revisões de uma execução são
carregadas quando ela é aberta.

Consequências honestas, ditas na própria tela:

- **as contagens das filas são da página carregada**, não da organização —
  `ArtifactExecutionQueryDto` não filtra por `renderStatus`;
- **a busca é a que o backend suporta**: código e título da execução. Não há
  busca pelo conteúdo do documento;
- **não há filtro por formato nem por renderizador**.

## 3. Viewer

Consome **exclusivamente o manifest**. O painel não conhece storage, bucket nem
chave — nada disso existe em contrato.

Mostra: revisão, formato, renderizador e versão, hash do conteúdo, hash da
fonte, versão do template, quem emitiu e quando.

### Preview antes de download

Formato com visualizador é **aberto**, não baixado. A URL de `preview` traz
`Content-Disposition: inline`; a de `download` traz `attachment`. São a mesma
assinatura sobre o mesmo objeto — e é o backend que decide, não a tela.

O quadro usa `sandbox=""` (sem `allow-scripts`): o documento é conteúdo de
tenant e, mesmo tendo sido escapado na geração, exibi-lo sem permissão de
execução é a segunda barreira.

### Revogado não se baixa

O backend recusa distribuir revisão revogada (403). A tela não tenta: mostra o
motivo e o registro, que permanece para auditoria.

## 4. Revisões

Lista, identifica a ativa, permite navegar e **compara metadados** — o que o
manifest publica.

**Sem diff visual**, como pedido. Comparar o conteúdo de dois documentos
exigiria interpretá-los, e nem o frontend nem o manifest fazem isso. O que muda
entre revisões é visível pela mudança do hash — a comparação honesta que o
contrato suporta.

## 5. Renderização

Integra a PR-20 sem duplicar nada dela.

**O estado é do backend**: `renderStatus` é lido, nunca escrito. Nenhuma rota o
aceita como entrada.

### Polling: sem infraestrutura nova

O enunciado pede para não criar polling próprio se já existir mecanismo
reutilizável. Existe: `refetchInterval` do TanStack Query, que já move a agenda,
a listagem de execuções e o contador de notificações.

A cadência é **condicional ao estado**: enquanto o backend diz `PENDING` ou
`RENDERING`, repete a cada três segundos; em `READY`, `FAILED` ou
`NOT_RENDERED`, para. Um documento pronto não precisa ser perguntado de novo, e
um falho não melhora sozinho.

Não há WebSocket para renderização — o gateway do backend é de notificações.
Nada aqui simula tempo real.

### Solicitar

O botão aparece quando o registry diz que o estado permite e quando plano e
papel liberam. Quem autoriza de fato é o backend: 409 (execução em estado que
não emite), 400 (renderizador desconhecido) ou 403 aparecem como vieram.

Renderizar de novo é legítimo e cria a revisão seguinte — a tela diz isso.

## 6. Downloads

**Exclusivamente URLs assinadas.** O storage nunca é endereçado pelo cliente.

A URL vem absoluta do backend e é usada como veio: não é reescrita nem
proxiada. Ela tem prazo curto, e a tela mostra até quando vale — em vez de o
usuário descobrir por uma falha silenciosa.

### Compartilhamento — placeholder arquitetural

A ação existe no registry com `available: false` e motivo declarado: **não há
contrato**. A URL assinada é curta e pessoal, e não existe endpoint que crie
link público ou envie por e-mail. O botão aparece desabilitado, com a
explicação no tooltip — quando o contrato existir, vira `available: true` e
nada mais muda.

## 7. Integração

| Com                    | Como                                                       |
| ---------------------- | ---------------------------------------------------------- |
| Entity Registry        | vínculos de operação, cliente, equipamento e artefato      |
| Template Type Registry | tipo do artefato e entidade principal                      |
| Artifact Execution     | atalho no Workspace; a central lê o estado de renderização |
| Artifact Studio        | o template é alcançado pelo Entity Registry                |
| Query Layer            | `useApiQuery`/`useApiMutation`, cache e invalidação        |
| BFF                    | `artifact-manifests` e `artifact-rendering` na allowlist   |

## 8. Endpoints utilizados

| Endpoint                                 | Uso                        |
| ---------------------------------------- | -------------------------- |
| `GET /artifact-executions`               | lista base da central      |
| `GET /artifact-executions/:id/manifests` | revisões                   |
| `GET /artifact-manifests/:id`            | detalhe com arquivo        |
| `GET /artifact-manifests/:id/download`   | URL assinada               |
| `GET /artifact-executions/:id/render`    | estado da renderização     |
| `POST /artifact-executions/:id/render`   | solicitar                  |
| `GET /artifact-rendering/metrics`        | renderizadores disponíveis |

`POST /artifact-manifests/:id/revoke` existe e **não** é consumido: revogar é
ato de governança e merece tela própria, fora do escopo desta PR.

## 9. Limitações do backend

| Limitação                                                 | Consequência                                 |
| --------------------------------------------------------- | -------------------------------------------- |
| Sem listagem global de manifests                          | a central parte das execuções                |
| `ArtifactExecutionQueryDto` não filtra por `renderStatus` | as filas contam a página, e a tela diz isso  |
| Sem busca pelo conteúdo do documento                      | a busca é por código e título da execução    |
| Sem filtro por formato ou renderizador                    | não são oferecidos                           |
| Sem endpoint de catálogo de renderizadores                | a lista vem de `/artifact-rendering/metrics` |
| Sem contrato de compartilhamento                          | ação declarada indisponível                  |
| Sem realtime para renderização                            | polling condicional, declarado na tela       |
| Sem `manifestId` no Read Model da execução                | a ligação é do manifest para a execução      |

## 10. Nenhuma regra de negócio no frontend

- não decide quando um documento pode ser emitido — 409 é do servidor;
- não calcula hash, não numera revisão, não escolhe qual é a ativa;
- não interpreta o conteúdo do documento;
- não decide autorização — permissões e capabilities são as que o backend exige;
- não monta rota de entidade à mão — Entity Registry;
- não inventa lista de renderizadores — vem publicada.
