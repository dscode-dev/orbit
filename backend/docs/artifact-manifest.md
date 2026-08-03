# Artifact Manifest

A representação oficial de um documento emitido pela plataforma.

---

## 1. O que o Manifest é

Um documento emitido pelo Orbit **é um manifest**. Não é um arquivo solto no
storage, não é uma coluna em `artifact_executions`, não é o retorno de uma
renderização. É um registro que responde, sozinho:

| Pergunta                              | Campo                            |
| ------------------------------------- | -------------------------------- |
| de que execução saiu?                 | `executionId`                    |
| com que estrutura?                    | `snapshotId`, `templateVersion`  |
| que revisão é esta?                   | `revision`                       |
| quem produziu o conteúdo?             | `renderer`, `rendererVersion`    |
| qual é o conteúdo, exatamente?        | `contentHash` (SHA-256)          |
| a execução mudou desde então?         | `sourceHash`                     |
| onde está o arquivo?                  | `file` (sem endereço do provider)|
| quem emitiu, quando?                  | `issuedBy`, `issuedAt`           |
| ainda vale?                           | `status`, `isActive`, `revokedAt`|

## 2. O que o Rendering Engine **não** vai precisar fazer

Esta PR existe para que a próxima seja pequena. Quando o Rendering Engine
chegar, ele gera bytes e os entrega. Não precisa decidir:

- **onde guardar** — o Storage resolve, e o provider é intercambiável;
- **como versionar** — a revisão é numerada sob trava, no banco;
- **quem pode ver** — capability, permissão e RLS já cercam cada rota;
- **como distribuir** — a URL assinada já existe, com prazo e auditoria;
- **como provar o conteúdo** — o hash é calculado sobre o que foi armazenado.

O contrato que ele usa é:

```
POST /artifact-executions/:id/manifests   → abre a revisão (DRAFT)
POST /artifact-manifests/:id/file         → recebe URL de upload
PUT  <url assinada>                       → entrega os bytes
POST /artifact-manifests/:id/issue        → confirma e emite
```

## 3. Ciclo de vida

```
                    ┌──────────────────────────────┐
   abrir revisão    │                              │
 ─────────────────▶ │  DRAFT                       │
                    │   │ confirmar arquivo        │
                    │   ▼                          │
                    │  ISSUED ◀── é a revisão ativa│
                    │   │                          │
      nova revisão  │   ├──▶ SUPERSEDED            │
        emitida     │   │                          │
                    │   └──▶ REVOKED               │
                    └──────────────────────────────┘
```

**Não há volta.** Uma revisão emitida não retorna a rascunho; um documento
revogado não é reemitido. Corrigir é abrir a revisão seguinte — é isso que
torna o histórico auditável.

### Quando se pode emitir

Só a partir de execução em `UNDER_REVIEW`, `APPROVED`, `COMPLETED` ou
`ARCHIVED`. Emitir de um rascunho produziria documento oficial de algo ainda
sendo preenchido. Verificado no E2E: execução em `DRAFT` → **409**.

### Apenas uma revisão ativa

Garantido pelo **banco**, não por convenção da aplicação:

```sql
CREATE UNIQUE INDEX artifact_manifests_single_active
  ON artifact_manifests(execution_id)
  WHERE is_active AND deleted_at IS NULL;
```

Duas emissões concorrentes não conseguem furar o invariante. A troca acontece
na mesma transação, sob `pg_advisory_xact_lock` por execução — a anterior vira
`SUPERSEDED` antes de a nova receber a bandeira.

## 4. Os dois hashes

`contentHash` e `sourceHash` respondem perguntas diferentes.

**`contentHash`** é o SHA-256 do arquivo emitido. É calculado pelo servidor
sobre o conteúdo **lido de volta do storage** — não sobre o que o cliente
declarou. Confiar no hash informado seria confiar no cliente sobre o próprio
conteúdo. É este valor que uma futura assinatura digital cobrirá.

**`sourceHash`** é o SHA-256 da execução no momento em que a revisão foi
aberta: estrutura do snapshot, respostas ordenadas e assinaturas. Serve para
responder *"o documento emitido ainda corresponde à execução?"* sem comparar
conteúdo nem reprocessar nada — se a execução mudou, o hash muda.

## 5. Revisões

Cada revisão publica número, hash, renderer, data e responsável — os cinco
itens pedidos. **Comparação entre revisões não foi implementada** (não era
escopo): o contrato já publica tudo que um diff futuro precisaria ler, e
nenhuma decisão desta PR o dificulta.

## 6. Endpoints

| Endpoint                                     | Capability                  | Permissão                    |
| -------------------------------------------- | --------------------------- | ---------------------------- |
| `GET /artifact-executions/:id/manifests`     | `artifact_manifests.read`   | `artifact_manifests.read`    |
| `POST /artifact-executions/:id/manifests`    | `artifact_manifests.manage` | `artifact_manifests.issue`   |
| `GET /artifact-manifests/:id`                | `artifact_manifests.read`   | `artifact_manifests.read`    |
| `POST /artifact-manifests/:id/file`          | `artifact_manifests.manage` | `artifact_manifests.issue`   |
| `POST /artifact-manifests/:id/issue`         | `artifact_manifests.manage` | `artifact_manifests.issue`   |
| `GET /artifact-manifests/:id/download`       | `artifact_manifests.read`   | `artifact_manifests.read`    |
| `POST /artifact-manifests/:id/revoke`        | `artifact_manifests.manage` | `artifact_manifests.revoke`  |

**Nenhum endpoint administrativo.** Não há listagem global de manifests, edição
de revisão nem remoção — revisão é imutável, e o que existe é o ciclo que o
domínio precisa.

## 7. Segurança

| Camada        | O que faz                                                    |
| ------------- | ------------------------------------------------------------ |
| RLS           | isolamento por organização **e por unidade**, como a execução |
| Capability    | o plano precisa incluir `artifact_manifests.*`                |
| RBAC          | papel precisa da permissão da ação                            |
| Política      | invariantes do ciclo de vida, testadas sem banco              |
| Auditoria     | abertura, emissão, revogação e **cada URL de download assinada** |
| Hash          | prova o conteúdo, calculado sobre o que está armazenado       |

A auditoria de download registra quem assinou o quê e quando — a URL é o
acesso, então emitir a URL é o evento que importa.

## 8. O que não aparece em resposta alguma

`bucket`, `objectKey`, caminho de sistema de arquivos, `fileId` e `deletedAt`.
Fixado em teste: `file-object.mapper.spec.ts` serializa os Read Models e
verifica que nem o nome do bucket nem a chave do objeto aparecem.

## 9. Lacunas para o Artifact Rendering Engine

Registradas aqui para a PR seguinte não redescobri-las:

| Lacuna                                              | Impacto na próxima PR                                  |
| --------------------------------------------------- | ------------------------------------------------------ |
| Não há motor de renderização                        | `renderer` é informado por quem abre a revisão          |
| `renderStatus` da execução continua `NOT_RENDERED`  | o campo existe desde a PR-06 e ninguém o move           |
| Sem fila ou job assíncrono                          | a emissão é síncrona; render longo precisará de fila    |
| Sem comparação entre revisões                       | o contrato publica o necessário; falta o diff           |
| Sem assinatura digital do documento                 | `contentHash` é o que ela cobrirá                       |
| Sem política de retenção do objeto                  | `remove` é recusado de propósito no provider S3         |
| Sem callback de conclusão de renderização           | quem emite hoje é quem entrega o arquivo                |
| Sem `manifestId` no Read Model da execução          | a ligação é do manifest para a execução, não o inverso  |

## 10. Verificação

```
unitários       140 testes, 42 suítes            todas passando
E2E             9 testes do ciclo completo       todas passando
  · execução em rascunho não emite               409
  · revisão 1 abre em DRAFT com sourceHash       ✓
  · rascunho não tem download                    409
  · upload assinado → hash confere com o enviado ✓
  · URL de download funciona e não vaza caminho  ✓
  · assinatura adulterada                        403
  · revisão 2 emitida → revisão 1 SUPERSEDED     activeRevision 2, só uma ativa
  · revogação para de distribuir                 403
  · sem sessão                                   401
build           nest build                       sem erros
lint            eslint                           sem erros
```
