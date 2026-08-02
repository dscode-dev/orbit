"use client";

/**
 * Estado da sessão de edição.
 *
 * Guarda a árvore em edição, a seleção e a versão que serviu de base. Todas as
 * alterações passam pelas operações genéricas de `lib/artifact-studio` — este
 * hook não sabe o que é seção nem o que é campo, só move, insere, remove e
 * altera nós.
 *
 * **Rebase.** O detalhe do template é recarregado por invalidação (publicar uma
 * versão, salvar propriedades). Quando a versão corrente muda e não há
 * alteração local pendente, o editor é reancorado na versão nova sem alarde.
 * Havendo alteração pendente — alguém publicou em outra aba, por exemplo — o
 * editor **não** descarta o trabalho: sinaliza e deixa a escolha para quem
 * está editando.
 */
import { useCallback, useMemo, useState } from "react";

import {
  documentFromVersion,
  findNode,
  insertNode,
  moveNode,
  removeNode,
  serializeDocument,
  updateNode,
  usedIdentifiers,
  type StudioContentNode,
  type StudioDocument,
  type StudioNode,
  type StudioRootNode,
} from "@/lib/artifact-studio";
import type { ArtifactTemplateVersion } from "@/types/artifact-templates";

/** Qual das duas árvores do documento uma operação atinge. */
export type StudioTreeName = "structure" | "signatures";

export interface StudioDocumentState {
  document: StudioDocument;
  selectedNodeId: string | null;
  selectedNode: StudioNode | null;
  selectedTree: StudioTreeName;
  /** Há alteração de estrutura ainda não publicada. */
  isDirty: boolean;
  /** A versão corrente do servidor avançou enquanto havia edição pendente. */
  hasNewerVersion: boolean;
  select: (nodeId: string | null, tree?: StudioTreeName) => void;
  insert: (tree: StudioTreeName, parentNodeId: string, node: StudioNode) => void;
  remove: (tree: StudioTreeName, nodeId: string) => void;
  move: (tree: StudioTreeName, nodeId: string, offset: number) => void;
  patch: <TNode extends StudioContentNode>(
    tree: StudioTreeName,
    nodeId: string,
    change: Partial<TNode>,
  ) => void;
  /** Identificadores já usados na árvore — para sugerir um livre. */
  identifiersIn: (tree: StudioTreeName) => readonly string[];
  /** Descarta a edição e reancora na versão corrente do servidor. */
  reset: () => void;
}

export function useStudioDocument(
  version: ArtifactTemplateVersion,
): StudioDocumentState {
  const [document, setDocument] = useState<StudioDocument>(() =>
    documentFromVersion(version),
  );
  /**
   * Base da comparação: a versão em que o editor está ancorado e a assinatura
   * serializada dela.
   *
   * Comparar payloads em vez de árvores ignora o que é só do editor —
   * `nodeId`, seleção — e reconhece como "sem alteração" um ir e voltar que
   * termina onde começou.
   */
  const [baseline, setBaseline] = useState(() => ({
    versionId: version.id,
    signature: signatureOf(documentFromVersion(version)),
  }));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTree, setSelectedTree] = useState<StudioTreeName>("structure");

  const rebase = useCallback((next: ArtifactTemplateVersion) => {
    const fresh = documentFromVersion(next);
    setDocument(fresh);
    setBaseline({ versionId: next.id, signature: signatureOf(fresh) });
    setSelectedNodeId(null);
  }, []);

  const isDirty = useMemo(
    () => signatureOf(document) !== baseline.signature,
    [document, baseline.signature],
  );

  /**
   * Reancora sozinho apenas quando não há nada a perder — ajuste durante a
   * renderização, não efeito: a decisão depende só de estado que já está aqui.
   */
  if (version.id !== baseline.versionId && !isDirty) {
    rebase(version);
  }

  const apply = useCallback(
    (tree: StudioTreeName, transform: (root: StudioRootNode) => StudioRootNode) => {
      setDocument((current) => ({
        ...current,
        [tree]: transform(current[tree]),
      }));
    },
    [],
  );

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return (
      findNode(document.structure, selectedNodeId) ??
      findNode(document.signatures, selectedNodeId) ??
      null
    );
  }, [document, selectedNodeId]);

  return {
    document,
    selectedNodeId,
    selectedNode,
    selectedTree,
    isDirty,
    hasNewerVersion: version.id !== baseline.versionId,

    select: (nodeId, tree) => {
      setSelectedNodeId(nodeId);
      if (tree) setSelectedTree(tree);
    },

    insert: (tree, parentNodeId, node) => {
      apply(tree, (root) => insertNode(root, parentNodeId, node));
      setSelectedNodeId(node.nodeId);
      setSelectedTree(tree);
    },

    remove: (tree, nodeId) => {
      apply(tree, (root) => removeNode(root, nodeId));
      setSelectedNodeId((current) => (current === nodeId ? null : current));
    },

    move: (tree, nodeId, offset) => {
      apply(tree, (root) => moveNode(root, nodeId, offset));
    },

    patch: (tree, nodeId, change) => {
      apply(tree, (root) =>
        updateNode(root, nodeId, (node) => ({ ...node, ...change })),
      );
    },

    identifiersIn: (tree) => usedIdentifiers(document[tree]),

    reset: () => rebase(version),
  };
}

/**
 * Assinatura do documento no formato que iria para a API.
 *
 * Quando a árvore está inválida (identificador repetido, por exemplo), a
 * serialização falha — e aí a assinatura carrega os problemas. Serve ao
 * propósito: um documento inválido é, por definição, diferente da base.
 */
function signatureOf(document: StudioDocument): string {
  const result = serializeDocument(document);
  return JSON.stringify(result.ok ? result.structure : result.problems);
}
