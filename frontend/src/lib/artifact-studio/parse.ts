/**
 * Entrada da fronteira do contrato: versão do backend → árvore do editor.
 *
 * Esta é uma das duas funções que conhecem o formato persistido (a outra é
 * `serialize.ts`). Tudo mais no Studio fala apenas a linguagem de nós.
 *
 * A ordem vem do backend em `order`, mas a árvore representa ordem por
 * posição. A conversão ordena aqui, uma vez, e daí em diante `order` deixa de
 * existir como estado editável — é recalculado ao serializar.
 *
 * **Ponto de extensão para geração assistida por IA:** qualquer produtor capaz
 * de montar um `StudioDocument` — a versão persistida hoje, um agente amanhã —
 * entra no editor pela mesma porta e sai pela mesma validação de
 * `serialize.ts`. Ver `docs/artifact-studio.md`.
 */
import type { ArtifactTemplateVersion } from "@/types/artifact-templates";
import {
  fieldNode,
  rootNode,
  sectionNode,
  signatureNode,
  type StudioDocument,
} from "./tree";

const byOrder = <T extends { order: number }>(a: T, b: T): number =>
  a.order - b.order;

export function documentFromVersion(
  version: ArtifactTemplateVersion,
): StudioDocument {
  const sections = [...version.sections].sort(byOrder).map((section) =>
    sectionNode(
      section,
      [...section.fields].sort(byOrder).map((field) => fieldNode(field)),
    ),
  );

  const signatures = [...version.signatureSlots]
    .sort(byOrder)
    .map((slot) => signatureNode(slot));

  return {
    structure: rootNode(sections),
    signatures: rootNode(signatures),
    metadata: { ...version.metadata },
    layout: layoutToRecord(version),
  };
}

/** Documento vazio — ponto de partida da criação de um template. */
export function emptyDocument(): StudioDocument {
  return {
    structure: rootNode([
      sectionNode({ id: "identificacao", title: "Identificação" }),
    ]),
    signatures: rootNode(),
    metadata: {},
    layout: {},
  };
}

/**
 * `layout` chega tipado como `ArtifactLayoutReadModel` e é carregado adiante
 * como JSON opaco: esta PR não edita layout, e reescrevê-lo campo a campo só
 * criaria oportunidade de perder o que o backend guardou.
 */
function layoutToRecord(
  version: ArtifactTemplateVersion,
): Record<string, unknown> {
  return { ...(version.layout as unknown as Record<string, unknown>) };
}
