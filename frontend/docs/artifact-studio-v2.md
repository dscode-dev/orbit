# Artifact Studio V2

O que mudou na PR-13, o que estava quebrado e por quê.

---

## 1. A publicação de versão estava quebrada — 500 no backend

**O botão "Publicar versão" nunca funcionou.** Reproduzido contra a API antes
de qualquer alteração:

```
POST /artifact-templates/:id/versions  →  500  "An unexpected error occurred"
```

Log do servidor:

```
PrismaClientKnownRequestError:
Invalid `prisma.$queryRaw()` invocation:
Raw query failed. Message: `Failed to deserialize column of type 'void'.`
  at ArtifactTemplateService.createVersion
```

**Causa.** `pg_advisory_xact_lock` retorna `void`, e `$queryRaw` tenta
desserializar a coluna do resultado. A trava funcionava; a chamada estourava —
desde a PR-17 do backend.

**Correção** (`artifact-template.repository.ts`): `$queryRaw` → `$executeRaw`.
Uma palavra. `$executeRaw` executa sem ler resultado, que é o que um lock
precisa.

O mesmo defeito existia em dois outros pontos, ainda sem sintoma reportado:
`report-template.repository.ts` (versão de template de relatório) e
`report.repository.ts` (numeração de relatório). Os três foram corrigidos —
é literalmente o mesmo erro, e deixar dois caminhos sabidamente quebrados não
faria sentido.

Verificado depois:

```
POST /artifact-templates/:id/versions  →  201  v2
```

## 2. Templates oficiais

### O problema

Uma organização recém-criada chegava ao Studio com **zero templates**. Não
havia nada de onde partir, e o Orbit não entregava os relatórios que a
plataforma oferece.

### A solução: templates globais, não cópias por tenant

O backend já modelava o conceito — a RLS da PR-17 permite ler
"future global catalog templates" — e o repositório já os inclui na listagem de
qualquer organização:

```ts
OR: [
  { organizationId },
  { organizationId: null, visibility: "GLOBAL", status: "ACTIVE" },
];
```

Faltava o conteúdo. A PR-13 acrescenta o catálogo oficial como **templates
globais semeados**:

| Chave                     | Nome                        | Tipo                |
| ------------------------- | --------------------------- | ------------------- |
| `ORBIT_ORDEM_SERVICO`     | Ordem de Serviço            | `ORDEM_SERVICO`     |
| `ORBIT_PMOC`              | PMOC                        | `PMOC`              |
| `ORBIT_RELATORIO_VISITA`  | Relatório de Visita Técnica | `RELATORIO_VISITA`  |
| `ORBIT_RELATORIO_TECNICO` | Relatório Técnico           | `RELATORIO_TECNICO` |
| `ORBIT_QUALIDADE_AR`      | Análise da Qualidade do Ar  | `QUALIDADE_AR`      |
| `ORBIT_RECIBO`            | Recibo                      | `RECIBO`            |
| `ORBIT_ORCAMENTO`         | Orçamento                   | `ORCAMENTO`         |

**Aparecem imediatamente para qualquer organização**, inclusive as criadas
depois da semeadura — porque não são cópias, são globais. Verificado numa
organização que nunca pediu nada:

```
GET /artifact-templates → 7 oficiais entre os 8 templates visíveis
```

### "Nunca perder o oficial" é estrutural, não uma convenção

A `ArtifactTemplatePolicy` recusa escrita em template global. Verificado:

```
PATCH /artifact-templates/{oficial} → 403 "Global and external templates are read-only"
```

Então o oficial **não pode** ser alterado por nenhuma organização. O ciclo é:

```
oficial (global, read-only)
    │  duplicar
    ▼
cópia da organização  ──editar──▶  publicar v2, v3…
    │
    │  "Restaurar do oficial"  →  traz a estrutura do global para o editor
    ▼
publica como versão nova (a v2 anterior continua no histórico)
```

Verificado ponta a ponta: duplicar o PMOC oficial (201), publicar v2 na cópia
(201), reler o oficial — continua na v1, com as 4 seções originais.

### Restaurar

Duas restaurações, ambas pela mesma mecânica — versões são imutáveis e não há
rota de reversão, então **restaurar é publicar uma versão nova com o conteúdo
antigo**:

- **Carregar no editor** (aba Versões): traz qualquer versão anterior;
- **Restaurar do oficial** (cabeçalho): traz a estrutura corrente do global.

Nos dois casos nada é sobrescrito no servidor. O documento vira alteração
pendente, e publicar continua sendo um ato explícito.

## 3. Fluxos revisados

| Fluxo                  | Situação                                                             |
| ---------------------- | -------------------------------------------------------------------- |
| Criar seção            | funcionava — mantido                                                 |
| Criar campo            | funcionava — mantido                                                 |
| Ordenação/movimentação | funcionava; o **punho de arrastar** foi removido (ver abaixo)        |
| Propriedades           | funcionava; sugestões de tipo agora vêm do Field Registry            |
| Preview                | funcionava — estrutural, sem renderização                            |
| **Publicação**         | **estava quebrada (500) — corrigida**                                |
| **Versionamento**      | **idem; e agora é possível carregar uma versão no editor**           |
| Duplicação             | funcionava — mantida, e agora é o caminho de personalizar um oficial |

### O punho de arrastar era uma mentira visual

Cada nó exibia um `GripVertical` — o ícone universal de "arraste-me". Não havia
arrastar e soltar. Foi substituído pela **posição** do nó, que é informação
real: é ela que vira `order` no contrato.

Mover continua sendo ação explícita (subir/descer), que é também o caminho
acessível por teclado e leitor de tela.

### Tipo de campo sem renderizador agora avisa

As sugestões de tipo passam a vir do **Field Registry** — os tipos que a
execução sabe desenhar. Um tipo fora dele é aceito pelo backend e cai no
tratamento genérico em campo; o inspetor diz isso na hora:

> Nenhum renderizador registrado para `TERMOGRAFIA`. O campo será exibido pelo
> tratamento genérico na execução.

Descobrir isso ao configurar é melhor do que descobrir durante a execução.

## 4. Template Type Registry no Studio

O tipo do artefato deixou de ser texto cru:

- **criar**: cartões com nome, categoria e descrição dos sete tipos, mais um
  campo livre recolhido para quem precisa de outra classificação;
- **filtrar**: `datalist` com o catálogo, sem fechar a digitação;
- **listar**: ícone, nome e categoria em vez do identificador;
- **cabeçalho do Studio**: crachá do tipo.

Nenhuma comparação com string sobrou. Ver `docs/template-type-registry.md`.

## 5. Endpoints utilizados

| Endpoint                                  | Uso                                   |
| ----------------------------------------- | ------------------------------------- |
| `GET /artifact-templates`                 | listagem, filtros e catálogo oficial  |
| `GET /artifact-templates/:id`             | detalhe com a versão corrente         |
| `POST /artifact-templates`                | criação                               |
| `PATCH /artifact-templates/:id`           | metadados (salvamento automático)     |
| `GET /artifact-templates/:id/versions`    | histórico                             |
| `GET /artifact-templates/:id/versions/:n` | comparação                            |
| `POST /artifact-templates/:id/versions`   | publicação                            |
| `POST /artifact-templates/:id/duplicate`  | personalizar oficial e duplicar cópia |
| `POST /artifact-templates/:id/activate`   | ativar                                |
| `POST /artifact-templates/:id/deactivate` | desativar                             |

`DELETE /artifact-templates/:id` existe e **não** é consumido: exclusão exige
desativar antes e não tem tela dedicada nesta PR.

## 6. Limitações do backend

| Limitação                                                  | Consequência                                                          |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Sem rota de reversão de versão                             | restaurar é publicar versão nova com conteúdo antigo                  |
| Sem nível de agrupamento dentro de seção                   | o Studio modela grupos; o contrato só tem `sections[].fields[]`       |
| Sem motor de renderização                                  | não há preview visual nem PDF; `renderStatus` é sempre `NOT_RENDERED` |
| `ArtifactTemplateQueryDto` sem ordenação                   | a ordem é a do servidor, declarada no cabeçalho                       |
| `visibility` de criação aceita só `PRIVATE`/`ORGANIZATION` | template global só nasce por semeadura da plataforma                  |
| Sem endpoint de catálogo oficial                           | o oficial é encontrado na listagem, filtrando por tipo                |
