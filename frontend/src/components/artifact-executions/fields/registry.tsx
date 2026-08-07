"use client";

/**
 * Field Registry — quem sabe desenhar cada tipo de campo.
 *
 * Mesma filosofia do Metric Registry e do Widget Registry: uma tabela única
 * resolve a chave que o backend publica para o componente que a apresenta, e
 * uma chave desconhecida **não quebra a tela**.
 *
 * Isso é o que permite acrescentar um tipo de campo sem tocar no Workspace. O
 * Workspace percorre `snapshot.sections[].fields[]` e pergunta ao registry;
 * ele não conhece `TEXT`, `PHOTO` nem tipo algum.
 *
 * **O tipo é metadado, não contrato.** O `ArtifactFieldDto` diz textualmente
 * que "the engine does not interpret it" e valida apenas o formato
 * (`/^[A-Z][A-Z0-9_.-]*$/`). Um tenant pode inventar `TERMOGRAFIA` amanhã —
 * daí o registrador cair em uma apresentação estruturada genérica em vez de
 * recusar o campo.
 */
import type { ComponentType } from "react";

import { createRegistry } from "@/registry";
import type { ArtifactField } from "@/types/artifact-templates";
import type {
  ArtifactExecutionAttachment,
  ArtifactExecutionResponse,
} from "@/types/artifact-executions";
import {
  BooleanEditor,
  BooleanView,
  ChoiceEditor,
  ChoiceView,
  DateTimeEditor,
  LongTextEditor,
  MediaEditor,
  MediaView,
  MultiChoiceEditor,
  MultiChoiceView,
  NumberEditor,
  NumberView,
  SignatureFieldView,
  StructuredEditor,
  StructuredView,
  TextEditor,
  TextView,
} from "./renderers";

export interface FieldViewProps {
  field: ArtifactField;
  response?: ArtifactExecutionResponse;
  /** Anexos vinculados a esta resposta, quando houver. */
  attachments?: readonly ArtifactExecutionAttachment[];
}

export interface FieldEditorProps extends FieldViewProps {
  disabled: boolean;
  saving: boolean;
  /** Envia o valor ao backend. O formato é escolha do renderizador. */
  onSave: (value: unknown) => void;
}

export interface FieldRenderer {
  /** Rótulo da família, usado em diagnóstico e no preview. */
  readonly family: string;
  readonly View: ComponentType<FieldViewProps>;
  /** Ausente quando o tipo não é preenchível por esta PR (assinatura). */
  readonly Editor?: ComponentType<FieldEditorProps>;
}

const TEXT: FieldRenderer = {
  family: "texto",
  View: TextView,
  Editor: TextEditor,
};

const LONG_TEXT: FieldRenderer = {
  family: "texto longo",
  View: TextView,
  Editor: LongTextEditor,
};

const NUMERIC: FieldRenderer = {
  family: "número",
  View: NumberView,
  Editor: NumberEditor,
};

const BOOLEAN: FieldRenderer = {
  family: "confirmação",
  View: BooleanView,
  Editor: BooleanEditor,
};

const CHOICE: FieldRenderer = {
  family: "escolha",
  View: ChoiceView,
  Editor: ChoiceEditor,
};

const MULTI_CHOICE: FieldRenderer = {
  family: "múltipla escolha",
  View: MultiChoiceView,
  Editor: MultiChoiceEditor,
};

const DATE_TIME: FieldRenderer = {
  family: "data e hora",
  View: TextView,
  Editor: DateTimeEditor,
};

const MEDIA: FieldRenderer = {
  family: "mídia",
  View: MediaView,
  Editor: MediaEditor,
};

const SIGNATURE: FieldRenderer = {
  family: "assinatura",
  View: SignatureFieldView,
};

const STRUCTURED: FieldRenderer = {
  family: "estruturado",
  View: StructuredView,
  Editor: StructuredEditor,
};

/**
 * Tipos conhecidos.
 *
 * A lista corresponde aos exemplos que o `ArtifactFieldDto` cita. Não é
 * exaustiva por natureza — é por isso que existe o fallback.
 *
 * Vários tipos compartilham renderizador de propósito: `NUMBER` e `DECIMAL`
 * se preenchem igual, e `SELECT` e `RADIO` diferem só na apresentação do
 * mesmo conjunto. O registro é por tipo, o renderizador é reaproveitado.
 */
const ENTRIES: readonly FieldRendererEntry[] = [
  { id: "TEXT", renderer: TEXT },
  { id: "LONG_TEXT", renderer: LONG_TEXT },
  { id: "OBSERVATION", renderer: LONG_TEXT },
  { id: "NUMBER", renderer: NUMERIC },
  { id: "DECIMAL", renderer: NUMERIC },
  { id: "CHECKBOX", renderer: BOOLEAN },
  { id: "SWITCH", renderer: BOOLEAN },
  { id: "SELECT", renderer: CHOICE },
  { id: "RADIO", renderer: CHOICE },
  { id: "MULTISELECT", renderer: MULTI_CHOICE },
  { id: "DATE", renderer: DATE_TIME },
  { id: "TIME", renderer: DATE_TIME },
  { id: "DATETIME", renderer: DATE_TIME },
  { id: "PHOTO", renderer: MEDIA },
  { id: "VIDEO", renderer: MEDIA },
  { id: "FILE", renderer: MEDIA },
  { id: "SIGNATURE", renderer: SIGNATURE },
  { id: "QR_CODE", renderer: TEXT },
  { id: "BARCODE", renderer: TEXT },
  { id: "LOCATION", renderer: STRUCTURED },
];

/** Um tipo de campo e o renderizador que o desenha. */
interface FieldRendererEntry {
  readonly id: string;
  readonly renderer: FieldRenderer;
}

const registry = createRegistry<FieldRendererEntry>({
  name: "artifact-fields",
  source: "src/components/artifact-executions/fields/registry.tsx",
  entries: ENTRIES,
  normalizeId: (id) => id.trim().toUpperCase(),
  /**
   * Tipo desconhecido cai na apresentação estruturada — que mostra o valor
   * como ele é e permite editá-lo como JSON. Preencher continua possível; o
   * que se perde é só o controle especializado.
   */
  derive: (id) => ({ id, renderer: STRUCTURED }),
});

/**
 * Resolve o renderizador de um tipo.
 *
 * Tipo não registrado cai na apresentação estruturada e avisa no console em
 * desenvolvimento, uma vez por tipo.
 */
export function resolveFieldRenderer(type: string): FieldRenderer {
  return registry.resolve(type).renderer;
}

/** Tipos com renderizador dedicado — usado na documentação da tela. */
export const REGISTERED_FIELD_TYPES: readonly string[] = registry.ids();
