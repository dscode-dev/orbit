# Document Registry

O catálogo do que é um **documento emitido** — e o lugar único onde a interface
decide o que formato, renderizador e estado de renderização significam.

`src/documents/document-registry.ts` · `import { … } from "@/documents"`

---

## 1. Por que existe, e por que não é o Template Type Registry

O **Template Type Registry** (PR-13) descreve _o que o artefato é_: PMOC, Ordem
de Serviço, Recibo. Este registry descreve _o que saiu dele_: em que formato,
por qual renderizador, em que estado, com que visualizador e que ações cabem.

A divisão importa. Um PMOC é um tipo de artefato; um PDF é um formato;
`pdf.default` é um renderizador. São três eixos independentes — o mesmo PMOC
pode sair em PDF ou HTML, e o mesmo PDF serve a vários tipos. Colapsá-los num
só lugar levaria a decisão de volta para `format === "PDF"` espalhado por
componentes, que é o que os registries existem para impedir.

```
Template Type Registry ──▶ que artefato é (PMOC, Recibo…)
Document Registry ─────▶ que documento saiu (PDF, HTML…)
                    └──▶ renderizador, estado, ações, visualizador
```

A delegação é explícita: `documentPrimaryEntity` e `documentTypeLabel`
resolvem no Template Type Registry em vez de repetir o mapa de entidades.

## 2. Os quatro eixos

### Formatos

```ts
interface DocumentFormatDefinition {
  id: string; // === `format` do manifest
  label: string;
  description: string;
  icon: DocumentIcon;
  color: string; // classe sobre tokens do Design System
  mimeType: string;
  viewer: DocumentViewer; // embedded · text · download-only
  previewable: boolean; // faz sentido abrir antes de baixar
}
```

| Formato | Visualizador | Preview |
| ------- | ------------ | ------- |
| `PDF`   | `embedded`   | sim     |
| `HTML`  | `embedded`   | sim     |
| `JSON`  | `text`       | sim     |

`viewer` é o que decide entre abrir e apenas oferecer o arquivo. Nenhum
componente pergunta "é PDF?" — pergunta ao registry qual visualizador usar.

### Estados de renderização

Os cinco valores de `renderStatus` publicados pela PR-20, cada um com leitura
visual e duas respostas de comportamento:

| Estado         | Rótulo          | `inFlight` | `canRequest` |
| -------------- | --------------- | ---------- | ------------ |
| `NOT_RENDERED` | Não renderizado | não        | sim          |
| `PENDING`      | Na fila         | **sim**    | não          |
| `RENDERING`    | Renderizando    | **sim**    | não          |
| `READY`        | Emitido         | não        | sim          |
| `FAILED`       | Falhou          | não        | sim          |

`inFlight` é o que liga e desliga a atualização periódica — a tela pergunta de
novo enquanto o servidor trabalha e para quando ele termina.

`canRequest` inclui `READY` de propósito: reemitir é legítimo e produz a
revisão seguinte, não uma sobrescrita.

### Renderizadores

`pdf.default` e `html.default` têm apresentação registrada. Mas **a lista viva
vem do backend** — `/artifact-rendering/metrics` publica `renderers`. O registry
nunca afirma que um renderizador existe; só rotula o que foi publicado. Um
identificador desconhecido aparece humanizado.

### Ações

```ts
interface DocumentAction {
  id: string;
  label: string;
  permission?: string; // exigida pelo backend
  capability?: string; // exigida pelo backend
  available: boolean;
  unavailableReason?: string;
}
```

| Ação       | Permissão                   | Capability                  |
| ---------- | --------------------------- | --------------------------- |
| `preview`  | `artifact_manifests.read`   | `artifact_manifests.read`   |
| `download` | `artifact_manifests.read`   | `artifact_manifests.read`   |
| `render`   | `artifact_rendering.render` | `artifact_rendering.render` |
| `revoke`   | `artifact_manifests.revoke` | `artifact_manifests.manage` |
| `share`    | —                           | —                           |

`permission` e `capability` são as que o **backend** exige; a interface as
consulta para não oferecer o que resultaria em 403. Quem autoriza continua
sendo o servidor.

`share` tem `available: false` com motivo declarado: não existe contrato de
compartilhamento. Declarar a ausência é diferente de esconder — o botão aparece
desabilitado e explica; quando o contrato existir, vira `available: true` e
nada mais muda.

## 3. Valor desconhecido não quebra a tela

`resolveFormat`, `resolveRenderStatus` e `resolveRenderer` sempre devolvem uma
definição. Para um identificador não registrado, derivam apresentação do
próprio identificador — formato desconhecido cai em `download-only`, porque sem
saber desenhá-lo resta oferecer o arquivo — e avisam **uma vez** no console
fora de produção, apontando o arquivo a editar.

O backend pode publicar um formato novo amanhã; a tela degrada, não quebra.

## 4. Componentes

`src/documents/document-components.tsx` — `DocumentFormatBadge`,
`RenderStatusBadge`, `RendererLabel`, `ContentHash`. Todos leem do registry e
usam apenas tokens e primitivas existentes do Design System.

### Duplicação eliminada

`components/artifact-executions/execution-badges.tsx` mantinha o próprio mapa de
estados de renderização desde a PR-06. Agora reexporta o do registry — a mesma
informação não diverge mais entre a execução e a central. Os nomes exportados
continuam iguais, então nenhum componente mudou de import.

## 5. O que o registry não faz

- não renderiza, não autoriza e não muda estado;
- não decide quando um documento pode ser emitido — 409 é do servidor;
- não interpreta o conteúdo do documento;
- não inventa lista de renderizadores.

Ver `docs/document-center.md` para a tela que o consome.
