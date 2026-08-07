/**
 * Document Registry — ponto único de apresentação de documentos emitidos.
 *
 * `import { resolveFormat, RenderStatusBadge } from "@/documents";`
 */
export {
  allFormats,
  allRenderStatuses,
  documentAction,
  documentPrimaryEntity,
  documentTypeLabel,
  isDocumentActionEnabled,
  resolveFormat,
  resolveRenderStatus,
  resolveRenderer,
  DOCUMENT_ACTIONS,
  type DocumentAction,
  type DocumentFormatDefinition,
  type DocumentIcon,
  type DocumentViewer,
  type RenderStatusDefinition,
  type RendererDefinition,
} from "./document-registry";
export {
  ContentHash,
  DocumentFormatBadge,
  RenderStatusBadge,
  RendererLabel,
} from "./document-components";
