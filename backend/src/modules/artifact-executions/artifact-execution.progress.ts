import { Injectable } from '@nestjs/common';
import type { ArtifactExecutionProgressReadModel } from './artifact-execution.read-models';

interface SectionShape {
  id?: string;
  fields?: { id?: string; required?: boolean; hidden?: boolean }[];
}
interface SlotShape {
  id?: string;
  required?: boolean;
}

@Injectable()
export class ArtifactExecutionProgressCalculator {
  calculate(
    sectionsValue: unknown,
    slotsValue: unknown,
    responses: readonly { sectionId: string; fieldId: string }[],
    signatures: readonly { slotId: string; revokedAt: Date | string | null }[],
  ): ArtifactExecutionProgressReadModel {
    const sections = (
      Array.isArray(sectionsValue) ? sectionsValue : []
    ) as SectionShape[];
    const slots = (Array.isArray(slotsValue) ? slotsValue : []) as SlotShape[];
    const fields = sections.flatMap((section) =>
      (section.fields ?? [])
        .filter((field) => !field.hidden && section.id && field.id)
        .map((field) => ({
          sectionId: section.id!,
          fieldId: field.id!,
          required: Boolean(field.required),
        })),
    );
    const answered = new Set(
      responses.map((r) => `${r.sectionId}:${r.fieldId}`),
    );
    const signed = new Set(
      signatures.filter((s) => !s.revokedAt).map((s) => s.slotId),
    );
    const answeredFields = fields.filter((f) =>
      answered.has(`${f.sectionId}:${f.fieldId}`),
    ).length;
    const required = fields.filter((f) => f.required);
    const requiredPending = required.filter(
      (f) => !answered.has(`${f.sectionId}:${f.fieldId}`),
    ).length;
    const requiredSlots = slots.filter((slot) => slot.required && slot.id);
    const pendingSignatures = requiredSlots.filter(
      (slot) => !signed.has(slot.id!),
    ).length;
    const completedSections = sections.filter((section) => {
      const visible = fields.filter((field) => field.sectionId === section.id);
      return (
        visible.length === 0 ||
        visible.every((field) =>
          answered.has(`${field.sectionId}:${field.fieldId}`),
        )
      );
    }).length;
    const denominator = fields.length + requiredSlots.length;
    const numerator = answeredFields + requiredSlots.length - pendingSignatures;
    return {
      percentage:
        denominator === 0 ? 100 : Math.round((numerator / denominator) * 100),
      totalFields: fields.length,
      answeredFields,
      requiredFields: required.length,
      requiredPending,
      totalSections: sections.length,
      completedSections,
      requiredSignatures: requiredSlots.length,
      pendingSignatures,
      canComplete: requiredPending === 0 && pendingSignatures === 0,
    };
  }
}
