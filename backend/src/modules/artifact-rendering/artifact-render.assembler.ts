/**
 * Montagem da entrada de renderização.
 *
 * Traduz o que o banco guarda — snapshot em JSON, respostas normalizadas,
 * assinaturas — no `RenderInput` que os renderers consomem. É o único lugar que
 * conhece as duas formas, e é o que mantém os renderers puros.
 *
 * Nada aqui decide conteúdo: ordena, casa resposta com campo e lê o branding do
 * layout. Campo sem resposta chega sem `value`, e é o renderer que decide como
 * mostrar ausência.
 */
import { Injectable } from '@nestjs/common';
import type {
  RenderBranding,
  RenderFieldInput,
  RenderInput,
  RenderSectionInput,
  RenderSignatureInput,
} from './renderers/artifact-renderer';

interface SnapshotSection {
  id?: unknown;
  title?: unknown;
  description?: unknown;
  order?: unknown;
  type?: unknown;
  fields?: unknown;
}

interface SnapshotField {
  id?: unknown;
  label?: unknown;
  type?: unknown;
  order?: unknown;
  required?: unknown;
  hidden?: unknown;
  description?: unknown;
  unit?: unknown;
}

interface SnapshotSlot {
  id?: unknown;
  label?: unknown;
  signerRole?: unknown;
  required?: unknown;
  order?: unknown;
}

export interface AssembleSource {
  execution: {
    id: string;
    code: string;
    title: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
  };
  snapshot: {
    id: string;
    templateKey: string;
    templateName: string;
    templateVersion: number;
    artifactType: string;
    structureHash: string;
    sections: unknown;
    signatureSlots: unknown;
    layout: unknown;
    metadata: unknown;
  };
  responses: readonly {
    sectionId: string;
    fieldId: string;
    value: unknown;
    unit: string | null;
    notes: string | null;
    answeredAt: Date;
  }[];
  signatures: readonly {
    slotId: string;
    signerName: string;
    signerDocument: string | null;
    signatureHash: string;
    signedAs: string | null;
    credentialType: string | null;
    credentialNumber: string | null;
    credentialRegion: string | null;
    signedAt: Date;
    revokedAt: Date | null;
  }[];
  organizationName: string;
  correlationId: string;
}

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const numeric = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const flag = (value: unknown): boolean => value === true;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

@Injectable()
export class ArtifactRenderAssembler {
  assemble(source: AssembleSource): RenderInput {
    const answers = new Map(
      source.responses.map((response) => [
        `${response.sectionId}::${response.fieldId}`,
        response,
      ]),
    );

    /** Assinatura revogada não conta como assinada — o bloco volta a "aguardando". */
    const collected = new Map(
      source.signatures
        .filter((signature) => signature.revokedAt === null)
        .map((signature) => [signature.slotId, signature]),
    );

    return {
      execution: {
        id: source.execution.id,
        code: source.execution.code,
        title: source.execution.title,
        status: source.execution.status,
        startedAt: source.execution.startedAt?.toISOString() ?? null,
        completedAt: source.execution.completedAt?.toISOString() ?? null,
      },
      snapshot: {
        id: source.snapshot.id,
        templateKey: source.snapshot.templateKey,
        templateName: source.snapshot.templateName,
        templateVersion: source.snapshot.templateVersion,
        artifactType: source.snapshot.artifactType,
        structureHash: source.snapshot.structureHash,
      },
      sections: this.sections(source.snapshot.sections, answers),
      signatures: this.signatures(source.snapshot.signatureSlots, collected),
      branding: this.branding(source.snapshot.layout, source.organizationName),
      layout: record(source.snapshot.layout),
      metadata: record(source.snapshot.metadata),
      correlationId: source.correlationId,
      generatedAt: new Date(),
    };
  }

  private sections(
    raw: unknown,
    answers: ReadonlyMap<string, AssembleSource['responses'][number]>,
  ): readonly RenderSectionInput[] {
    const sections = Array.isArray(raw) ? (raw as SnapshotSection[]) : [];

    return sections
      .map((section, index): RenderSectionInput => {
        const sectionId = text(section.id, `secao_${index + 1}`);
        const fields = Array.isArray(section.fields)
          ? (section.fields as SnapshotField[])
          : [];

        return {
          id: sectionId,
          title: text(section.title, sectionId),
          description: text(section.description) || undefined,
          order: numeric(section.order, index + 1),
          type: text(section.type, 'FORM'),
          fields: fields.map((field, position): RenderFieldInput => {
            const fieldId = text(field.id, `campo_${position + 1}`);
            const answer = answers.get(`${sectionId}::${fieldId}`);

            return {
              id: fieldId,
              label: text(field.label, fieldId),
              type: text(field.type, 'TEXT'),
              order: numeric(field.order, position + 1),
              required: flag(field.required),
              hidden: flag(field.hidden),
              description: text(field.description) || undefined,
              /** A unidade da resposta tem precedência sobre a do template. */
              unit: answer?.unit ?? (text(field.unit) || undefined),
              value: answer?.value,
              answeredAt: answer?.answeredAt.toISOString(),
              notes: answer?.notes ?? null,
            };
          }),
        };
      })
      .sort((left, right) => left.order - right.order);
  }

  private signatures(
    raw: unknown,
    collected: ReadonlyMap<string, AssembleSource['signatures'][number]>,
  ): readonly RenderSignatureInput[] {
    const slots = Array.isArray(raw) ? (raw as SnapshotSlot[]) : [];

    return slots
      .map((slot, index): RenderSignatureInput => {
        const slotId = text(slot.id, `assinatura_${index + 1}`);
        const signature = collected.get(slotId);

        return {
          slotId,
          label: text(slot.label, slotId),
          signerRole: text(slot.signerRole, 'SIGNER'),
          required: flag(slot.required),
          order: numeric(slot.order, index + 1),
          signerName: signature?.signerName,
          signerDocument: signature?.signerDocument ?? null,
          signedAt: signature?.signedAt.toISOString(),
          signatureHash: signature?.signatureHash,
          signedAs: signature?.signedAs ?? undefined,
          professionalCredential:
            signature?.credentialType && signature.credentialNumber
              ? [
                  signature.credentialType,
                  signature.credentialRegion,
                  signature.credentialNumber,
                ]
                  .filter(Boolean)
                  .join('-')
              : undefined,
        };
      })
      .sort((left, right) => left.order - right.order);
  }

  /**
   * Identidade visual.
   *
   * Sai de `layout.visualIdentity`, que é JSON livre no contrato. Cada chave é
   * lida com tolerância e cai no padrão quando ausente — o documento nunca
   * depende de o tenant ter configurado branding.
   */
  private branding(layout: unknown, organizationName: string): RenderBranding {
    const identity = record(record(layout).visualIdentity);
    const header = record(record(layout).header);
    const footer = record(record(layout).footer);

    return {
      organizationName: text(identity.organizationName, organizationName),
      documentTitle: text(identity.documentTitle) || undefined,
      primaryColor: text(identity.primaryColor) || undefined,
      headerText: text(header.text) || undefined,
      footerText: text(footer.text) || undefined,
    };
  }
}
