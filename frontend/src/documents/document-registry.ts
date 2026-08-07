/**
 * Document Registry — o catálogo do que é um documento emitido.
 *
 * Enquanto o **Template Type Registry** descreve *o que o artefato é*
 * (Ordem de Serviço, PMOC, Recibo), este registry descreve *o que o documento
 * emitido é*: em que formato saiu, que renderizador o produziu, em que estado
 * está a renderização, o que se pode fazer com ele e com que visualizador
 * abri-lo.
 *
 * A divisão importa. Um PMOC é um tipo de artefato; um PDF é um formato de
 * documento; `pdf.default` é um renderizador. Misturar os três num só lugar
 * faria a tela decidir por comparação de string — que é exatamente o que os
 * registries da plataforma existem para impedir.
 *
 * ```
 * Template Type Registry ──▶ que artefato é (PMOC, Recibo…)
 * Document Registry ─────▶ que documento saiu (PDF, HTML…)
 *                     └──▶ renderer, estado, ações, visualizador
 * ```
 *
 * Regras, as mesmas dos demais registries:
 *
 * - **nenhum componente compara formato, renderer ou estado com string**;
 * - **o registry não decide o que o backend decide** — ele não renderiza, não
 *   autoriza e não muda estado;
 * - **valor desconhecido não quebra a tela**: a resolução deriva do próprio
 *   identificador e avisa no console em desenvolvimento.
 *
 * Ver `docs/document-registry.md`.
 */
import type { ComponentType } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileCode2,
  FileJson,
  FileText,
  Loader2,
  MinusCircle,
  type LucideProps,
} from "lucide-react";

import { resolveTemplateType } from "@/artifacts";
import type { EntityId } from "@/entities/entity-registry";
import type { ManifestFormat, RenderStatus } from "@/types/documents";

export type DocumentIcon = ComponentType<LucideProps>;

/* ------------------------------------------------------------------ */
/* Formatos                                                            */
/* ------------------------------------------------------------------ */

/**
 * Como o documento pode ser aberto.
 *
 * - `embedded` — o navegador desenha sozinho num quadro (PDF, HTML).
 * - `text` — mostrado como texto formatado (JSON).
 * - `download-only` — não há visualizador; resta baixar.
 */
export type DocumentViewer = "embedded" | "text" | "download-only";

export interface DocumentFormatDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly icon: DocumentIcon;
  readonly color: string;
  readonly mimeType: string;
  readonly viewer: DocumentViewer;
  /** `true` quando faz sentido abrir antes de baixar. */
  readonly previewable: boolean;
}

const FORMATS: readonly DocumentFormatDefinition[] = [
  {
    id: "PDF",
    label: "PDF",
    description: "Documento paginado, pronto para impressão e arquivamento.",
    icon: FileText,
    color: "text-destructive",
    mimeType: "application/pdf",
    viewer: "embedded",
    previewable: true,
  },
  {
    id: "HTML",
    label: "HTML",
    description: "Documento em marcação, inspecionável e leve.",
    icon: FileCode2,
    color: "text-sky-400",
    mimeType: "text/html",
    viewer: "embedded",
    previewable: true,
  },
  {
    id: "JSON",
    label: "JSON",
    description: "Conteúdo estruturado, para integração.",
    icon: FileJson,
    color: "text-amber-400",
    mimeType: "application/json",
    viewer: "text",
    previewable: true,
  },
];

const FORMAT_BY_ID = new Map(FORMATS.map((format) => [format.id, format]));

/* ------------------------------------------------------------------ */
/* Estados de renderização                                             */
/* ------------------------------------------------------------------ */

/** Leitura visual de um estado — cor sobre tokens existentes. */
export interface RenderStatusDefinition {
  readonly id: RenderStatus;
  readonly label: string;
  readonly description: string;
  readonly icon: DocumentIcon;
  readonly color: string;
  readonly badgeClass: string;
  /** O servidor ainda está trabalhando; a tela acompanha. */
  readonly inFlight: boolean;
  /** Pedir renderização faz sentido neste estado. */
  readonly canRequest: boolean;
}

const RENDER_STATUSES: readonly RenderStatusDefinition[] = [
  {
    id: "NOT_RENDERED",
    label: "Não renderizado",
    description: "Nenhum documento foi emitido para esta execução.",
    icon: MinusCircle,
    color: "text-muted-foreground",
    badgeClass: "bg-surface-strong text-muted-foreground",
    inFlight: false,
    canRequest: true,
  },
  {
    id: "PENDING",
    label: "Na fila",
    description: "A renderização foi pedida e aguarda processamento.",
    icon: Clock,
    color: "text-amber-400",
    badgeClass: "bg-amber-500/15 text-amber-400",
    inFlight: true,
    canRequest: false,
  },
  {
    id: "RENDERING",
    label: "Renderizando",
    description: "O documento está sendo produzido agora.",
    icon: Loader2,
    color: "text-primary",
    badgeClass: "bg-primary/15 text-primary",
    inFlight: true,
    canRequest: false,
  },
  {
    id: "READY",
    label: "Emitido",
    description: "O documento está pronto e disponível.",
    icon: CheckCircle2,
    color: "text-emerald-400",
    badgeClass: "bg-emerald-500/15 text-emerald-400",
    inFlight: false,
    /** Reemitir é legítimo: gera a revisão seguinte. */
    canRequest: true,
  },
  {
    id: "FAILED",
    label: "Falhou",
    description: "As tentativas se esgotaram; o motivo está registrado.",
    icon: AlertTriangle,
    color: "text-destructive",
    badgeClass: "bg-destructive/15 text-destructive",
    inFlight: false,
    canRequest: true,
  },
];

const STATUS_BY_ID = new Map(
  RENDER_STATUSES.map((status) => [status.id, status]),
);

/* ------------------------------------------------------------------ */
/* Renderizadores                                                      */
/* ------------------------------------------------------------------ */

/**
 * Renderizadores conhecidos.
 *
 * **A lista viva vem do backend** (`/artifact-rendering/metrics` publica
 * `renderers`). O registry só acrescenta apresentação ao identificador — nunca
 * afirma que um renderizador existe. Um identificador publicado e não
 * registrado aparece humanizado.
 */
export interface RendererDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Formato que ele produz, para a tela antecipar o visualizador. */
  readonly format: ManifestFormat;
}

const RENDERERS: readonly RendererDefinition[] = [
  {
    id: "pdf.default",
    label: "PDF padrão",
    description: "Documento paginado, com cabeçalho, rodapé e assinaturas.",
    format: "PDF",
  },
  {
    id: "html.default",
    label: "HTML padrão",
    description: "Mesma composição em marcação, sem paginação física.",
    format: "HTML",
  },
];

const RENDERER_BY_ID = new Map(
  RENDERERS.map((renderer) => [renderer.id, renderer]),
);

/* ------------------------------------------------------------------ */
/* Ações                                                               */
/* ------------------------------------------------------------------ */

/**
 * Ação sobre um documento emitido.
 *
 * `permission` e `capability` são as **exigidas pelo backend** — a interface as
 * usa para não oferecer o que resultaria em 403. Quem autoriza é o servidor.
 *
 * `available: false` declara contrato inexistente em vez de esconder a ação.
 */
export interface DocumentAction {
  readonly id: string;
  readonly label: string;
  readonly permission?: string;
  readonly capability?: string;
  readonly available: boolean;
  readonly unavailableReason?: string;
}

export const DOCUMENT_ACTIONS: readonly DocumentAction[] = [
  {
    id: "preview",
    label: "Visualizar",
    permission: "artifact_manifests.read",
    capability: "artifact_manifests.read",
    available: true,
  },
  {
    id: "download",
    label: "Baixar",
    permission: "artifact_manifests.read",
    capability: "artifact_manifests.read",
    available: true,
  },
  {
    id: "render",
    label: "Renderizar",
    permission: "artifact_rendering.render",
    capability: "artifact_rendering.render",
    available: true,
  },
  {
    id: "revoke",
    label: "Revogar",
    permission: "artifact_manifests.revoke",
    capability: "artifact_manifests.manage",
    available: true,
  },
  {
    id: "share",
    label: "Compartilhar",
    available: false,
    unavailableReason:
      "Não há contrato de compartilhamento: a URL assinada é curta e pessoal, e não existe endpoint que crie link público ou envie por e-mail.",
  },
];

const ACTION_BY_ID = new Map(
  DOCUMENT_ACTIONS.map((action) => [action.id, action]),
);

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

const reportedUnknown = new Set<string>();

function warnOnce(kind: string, id: string): void {
  const key = `${kind}:${id}`;
  if (process.env.NODE_ENV === "production" || reportedUnknown.has(key)) return;
  reportedUnknown.add(key);
  console.warn(
    `[documents] ${kind} "${id}" não registrado — usando apresentação derivada. ` +
      `Registre-o em src/documents/document-registry.ts.`,
  );
}

function humanize(id: string): string {
  return id
    .split(/[._-]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function allFormats(): readonly DocumentFormatDefinition[] {
  return FORMATS;
}

export function resolveFormat(id: string): DocumentFormatDefinition {
  const normalized = id.trim().toUpperCase();
  const known = FORMAT_BY_ID.get(normalized);
  if (known) return known;

  warnOnce("formato", normalized);
  return {
    id: normalized,
    label: normalized,
    description: "Formato publicado pelo backend e ainda não registrado.",
    icon: FileText,
    color: "text-muted-foreground",
    mimeType: "application/octet-stream",
    /** Sem saber desenhar, resta oferecer o arquivo. */
    viewer: "download-only",
    previewable: false,
  };
}

export function allRenderStatuses(): readonly RenderStatusDefinition[] {
  return RENDER_STATUSES;
}

export function resolveRenderStatus(id: string): RenderStatusDefinition {
  const known = STATUS_BY_ID.get(id as RenderStatus);
  if (known) return known;

  warnOnce("estado de renderização", id);
  return {
    id: id as RenderStatus,
    label: humanize(id),
    description: "Estado publicado pelo backend e ainda não registrado.",
    icon: MinusCircle,
    color: "text-muted-foreground",
    badgeClass: "bg-surface-strong text-muted-foreground",
    inFlight: false,
    canRequest: false,
  };
}

export function resolveRenderer(id: string): RendererDefinition {
  const known = RENDERER_BY_ID.get(id);
  if (known) return known;

  warnOnce("renderizador", id);
  /**
   * O formato é inferido do prefixo apenas para apresentação.
   *
   * A verdade sobre o formato está no manifest (`format`), que é o que a tela
   * usa para escolher visualizador — isto aqui só rotula um identificador.
   */
  const prefix = id.split(".")[0]?.toUpperCase() ?? "";
  return {
    id,
    label: humanize(id),
    description: "Renderizador publicado pelo backend e ainda não registrado.",
    format: (FORMAT_BY_ID.has(prefix) ? prefix : "PDF") as ManifestFormat,
  };
}

export function documentAction(id: string): DocumentAction | undefined {
  return ACTION_BY_ID.get(id);
}

/** `true` quando o plano e o papel liberam a ação — e ela existe. */
export function isDocumentActionEnabled(
  action: DocumentAction,
  access: {
    hasPermission: (permission: string) => boolean;
    hasCapability: (capability: string) => boolean;
  },
): boolean {
  if (!action.available) return false;
  if (action.permission && !access.hasPermission(action.permission)) {
    return false;
  }
  if (action.capability && !access.hasCapability(action.capability)) {
    return false;
  }
  return true;
}

/**
 * Entidade que o documento descreve.
 *
 * Delega ao Template Type Registry, que já sabe que um PMOC descreve um
 * equipamento e um recibo descreve um cliente. O Document Registry não repete
 * esse mapa.
 */
export function documentPrimaryEntity(artifactType: string): EntityId {
  return resolveTemplateType(artifactType).primaryEntity;
}

/** Rótulo do tipo de artefato — também do Template Type Registry. */
export function documentTypeLabel(artifactType: string): string {
  return resolveTemplateType(artifactType).name;
}
