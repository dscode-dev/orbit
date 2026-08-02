# Artifact Studio

Ambiente de configuração dos Artifact Templates. Consome exclusivamente o
módulo `artifact-templates` do backend (PR-17), pelo BFF.

|            |                                                                               |
| ---------- | ----------------------------------------------------------------------------- |
| Rotas      | `/artefatos` (listagem) e `/artefatos/[id]` (editor)                          |
| Capability | `artifact_templates.read` para abrir, `artifact_templates.manage` para editar |
| Permissões | `artifact_templates.read` · `.create` · `.update`                             |
| Contratos  | `src/types/contracts/modules/artifact-templates/` (sincronizados)             |

---

## 1. As duas propriedades do contrato que definem tudo

Antes de qualquer decisão de interface, duas características do backend:

**1. `PATCH /artifact-templates/:id` altera apenas metadados.** Nome,
descrição, tipo, segmento, visibilidade, etiquetas e ordenação. A estrutura não
tem rota de edição em lugar.

**2. `POST /artifact-templates/:id/versions` é o único caminho para mudar a
estrutura — e ele cria uma versão nova e imutável**, incrementando
`currentVersion` sob `pg_advisory_xact_lock`.

Disso decorre o comportamento do Studio:

| Área                           | Como persiste                              | Por quê                               |
| ------------------------------ | ------------------------------------------ | ------------------------------------- |
| Propriedades                   | **salvamento automático** (1,2 s de pausa) | a escrita é idempotente e no lugar    |
| Estrutura, campos, assinaturas | **publicação explícita** de versão         | cada salvamento seria uma versão nova |

Salvar estrutura automaticamente produziria uma versão por pausa de digitação e
apagaria a diferença entre "estou mexendo" e "publiquei". Auto Save existe
**apenas onde o backend o suporta** — que é exatamente o pedido da PR.

---

## 2. Árvore de nós, não formulário de seções

O editor não trabalha com `Section[]` e `Field[]`. Trabalha com uma árvore de
nós genéricos:

```
root
└── section
    ├── group          ← existe no modelo, ainda não no contrato
    │   └── field
    └── field
```

A razão é o custo de mudança. Um editor escrito contra dois tipos concretos
precisa de uma função de mover seção, outra de mover campo, outra de remover
seção, outra de remover campo — e ganha mais um par a cada elemento de layout
que surgir (grupos, colunas, abas, acordeões). O editor de árvore tem **uma**
função de mover e **uma** de remover; um tipo novo entra declarando onde pode
morar.

```ts
// src/lib/artifact-studio/tree.ts
const ALLOWED_PARENTS: Record<StudioNodeKind, readonly StudioNodeKind[]> = {
  root: [],
  section: ["root"],
  group: ["section", "group"],
  field: ["section", "group"],
  signature: ["root"],
};
```

`insertNode` e `moveNodeTo` consultam essa tabela. Acrescentar "coluna" é
acrescentar uma linha ali e um caso no inspetor — nenhuma tela muda.

### Duas propriedades que valem o desenho

**A posição no array é a ordem.** O campo `order` do contrato é derivado no
momento de serializar. Isso elimina de origem o `Duplicate section order values`
que o `ArtifactTemplateValidator` rejeita — não há como o editor produzir
ordens repetidas.

**`nodeId` não é o `id` do contrato.** O primeiro é interno e estável durante a
edição; o segundo é o identificador de negócio, escolhido pelo usuário e
validado pelo backend. Sem essa separação, renomear o identificador faria o nó
selecionado sumir da tela.

### A fronteira do contrato

Só dois arquivos conhecem o formato persistido:

```
versão do backend ──> parse.ts ──> StudioDocument ──> serialize.ts ──> corpo da API
```

`serialize.ts` faz três coisas e nenhuma além delas:

1. deriva `order` da posição;
2. **recusa** o que o contrato não expressa — hoje, nós de grupo;
3. antecipa as restrições que o backend declara.

Sobre (2): achatar grupos em silêncio perderia a intenção de quem editou. O
Studio prefere dizer que falta suporte no backend.

Sobre (3): nada ali é regra inventada. Cada verificação corresponde a uma
restrição declarada em `ArtifactTemplateDto` ou no `ArtifactTemplateValidator` —
formato de identificador, unicidade, quantidade mínima de seções. O servidor
continua decidindo, e a recusa dele é apresentada como veio.

---

## 3. Camadas

```
app/artefatos/page.tsx           Server Component — guards e shell
app/artefatos/[id]/page.tsx      Server Component — resolve o parâmetro

src/services/artifact-templates.service.ts    espelho do controller
src/hooks/artifact-templates/                 Query Layer
src/lib/artifact-studio/                      modelo (sem React)
src/components/artifact-studio/               interface
```

**Server Components** compõem guards, shell e cabeçalho — não têm dados nem
estado. Não há prefetch no servidor: a listagem depende de filtros escolhidos
no cliente e o editor é uma sessão de edição, então buscar no servidor
duplicaria a requisição.

**Client Components** cobrem tudo que é interação: filtros, diálogos, árvore,
inspetor, comparação.

O modelo (`src/lib/artifact-studio/`) é TypeScript puro, sem React. É o que
permite exercitá-lo sem árvore de componentes e reaproveitá-lo em outra
superfície.

### Cadências

| Leitura              | `staleTime` | Por quê                            |
| -------------------- | ----------- | ---------------------------------- |
| Listagem             | 1 min       | muda por ato de configuração       |
| Detalhe              | 30 s        | idem                               |
| Histórico de versões | 5 min       | só cresce                          |
| Versão específica    | `Infinity`  | **imutável** — publicada, não muda |

Não há `refetchInterval` em lugar nenhum: recarregar sozinho um formulário em
edição só teria como efeito atrapalhar quem edita.

### Estados

Cada aba tem Error Boundary próprio (`StudioBoundary`) — uma aba que quebre não
pode derrubar a de versões, que é por onde o trabalho é publicado. Carregamento
usa `Skeleton` e `PanelLoading`; erro, vazio e acesso negado vêm dos primitivos
de painel da PR-03, com 403 tratado como ausência de acesso e não como falha.

---

## 4. Somente leitura

Acontece por três motivos distintos, todos do backend:

| Motivo                                         | Sinal                                         | O que o Studio oferece |
| ---------------------------------------------- | --------------------------------------------- | ---------------------- |
| Template da plataforma (`organizationId` nulo) | `Global and external templates are read-only` | "Duplicar para editar" |
| Sem `artifact_templates.update`                | 403                                           | consulta da estrutura  |
| Plano sem `artifact_templates.manage`          | 403                                           | consulta da estrutura  |

A interface antecipa os três para ninguém editar por vinte minutos até levar
403 ao publicar. Quem decide continua sendo o servidor.

---

## 5. Comparação de versões

Não há rota de diferença no backend — e não precisa haver: versões são payloads
imutáveis, e comparar dois estados já recebidos é apresentação.

O pareamento é **por `id` de contrato**, não por posição. Um campo que trocou de
lugar aparece como _movido_, não como um removido mais um adicionado, que seria
ruído em toda reordenação.

Para `configuration`, `validations` e `dependencies` — JSON livre sem esquema —
a comparação é por serialização com chaves ordenadas. É o único critério
honesto de "mudou" para um valor cuja forma o backend não define.

---

## 6. Preview estrutural

Mostra a forma do artefato: seções na ordem, campos na ordem, o que é
obrigatório, o que está oculto, quais assinaturas existem.

**Não simula o preenchimento.** O `ArtifactFieldDto` diz, textualmente:
_"Metadata-driven field type. The engine does not interpret it."_ Quem decide
que `LOCATION` vira mapa e `QR_CODE` vira leitor é o executor do artefato, e
cada um pode decidir diferente. Desenhar um controle de mentira prometeria um
comportamento que o Studio não conhece e não controla.

Pelo mesmo motivo, os campos de JSON livre são editados **como JSON**
(`json-field.tsx`): um formulário com campos nomeados inventaria uma estrutura
que o servidor não tem.

---

## 7. Preparação para geração assistida por IA

A estrutura já está posta, e o ponto de entrada é único:

```
     versão persistida ─┐
                        ├──> StudioDocument ──> serialize.ts ──> backend
     agente de IA ──────┘        (árvore)         (validação)
```

Um gerador precisa apenas **produzir um `StudioDocument`**. A partir daí ele
herda, sem código novo:

- a validação de `serialize.ts` — nada gerado chega ao backend sem passar pelas
  mesmas restrições de identificador, unicidade e limite;
- a ordem derivada da posição;
- a comparação (`compareVersions`) para mostrar o que a geração mudaria antes
  de publicar;
- o preview estrutural;
- a publicação como versão, com autoria e `changeSummary` — a geração vira uma
  versão auditável como qualquer outra, não uma escrita invisível.

O que **falta no backend** para isso existir de verdade: não há hoje um
`purpose` de geração de template em `ai-executions`, nem um contrato de saída
que descreva estrutura de artefato. Enquanto não houver, a única coisa honesta
é deixar o encaixe pronto e não simular a geração.

Uma recomendação de desenho para quando chegar: a saída do agente deve entrar
como **proposta**, não como estado. Ou seja, `documentFromGenerated()` produz um
`StudioDocument` que o usuário compara com o atual e publica — nunca uma
escrita direta em `POST /versions`.

---

## 8. Limitações conhecidas

| Limitação                                                      | Origem                                                                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **`POST /:id/versions` responde 500**                          | defeito no backend — ver abaixo                                                                      |
| Grupos e colunas não são persistidos                           | o contrato tem `sections[].fields[]`, sem nível intermediário                                        |
| Sem arrastar e soltar                                          | decisão de escopo desta PR; mover é ação explícita, que também é o caminho acessível                 |
| Não é possível **remover** um segmento já gravado              | `UpdateArtifactTemplateDto` aceita string ou omissão, não `null`                                     |
| A chave (`key`) não é editável                                 | não há rota que a altere; para outra chave, duplique                                                 |
| Exclusão de template não é oferecida                           | `DELETE /:id` existe, mas destruir configuração não estava no escopo pedido                          |
| Ordenação da listagem não é escolhível                         | `ArtifactTemplateQueryDto` não aceita parâmetro de ordenação (`sortOrder asc, name asc` no servidor) |
| Layout (`header`, `footer`, `logo`, `numbering`) não é editado | carregado e devolvido intacto; edição visual é escopo próprio                                        |

### O 500 ao publicar versão

`artifact-template.repository.ts` toma o lock de versão assim:

```ts
await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${chave}))`;
```

`pg_advisory_xact_lock` retorna `void`, e o `$queryRaw` do Prisma tenta
desserializar a coluna:

```
Raw query failed. Message: `Failed to deserialize column of type 'void'.`
```

Toda publicação de versão falha — de forma determinística, não intermitente. O
Studio apresenta a recusa com o `requestId`, mas o fluxo depende da correção no
backend. `$executeRaw` no lugar de `$queryRaw` resolve (ele não desserializa
retorno), assim como `::text` no `SELECT`.

Verificado nesta ordem, contra o backend real: criação com estrutura completa
✓, leitura ✓, `PATCH` de metadados ✓, ativação ✓, desativação ✓, duplicação ✓,
conflito de chave ✓, **publicação de versão ✗ (500)**.
