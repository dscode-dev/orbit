import { Injectable } from '@nestjs/common';
import { ValidationException } from '../../exceptions';

interface SnapshotSection {
  id?: string;
  fields?: {
    id?: string;
    type?: string;
    unit?: string;
    validations?: unknown[];
  }[];
}
interface SnapshotSlot {
  id?: string;
  signerRole?: string;
}

@Injectable()
export class ArtifactExecutionValidator {
  field(sectionsValue: unknown, sectionId: string, fieldId: string) {
    const sections = (
      Array.isArray(sectionsValue) ? sectionsValue : []
    ) as SnapshotSection[];
    const section = sections.find((item) => item.id === sectionId);
    const field = section?.fields?.find((item) => item.id === fieldId);
    if (!field)
      throw new ValidationException(
        'Response field does not exist in the execution snapshot',
      );
    return {
      type: field.type ?? 'UNKNOWN',
      unit: field.unit,
      validations: field.validations ?? [],
    };
  }

  signatureSlot(slotsValue: unknown, slotId: string) {
    const slots = (
      Array.isArray(slotsValue) ? slotsValue : []
    ) as SnapshotSlot[];
    const slot = slots.find((item) => item.id === slotId);
    if (!slot)
      throw new ValidationException(
        'Signature slot does not exist in the execution snapshot',
      );
    return { signerRole: slot.signerRole ?? 'UNKNOWN' };
  }

  schedule(start?: string, end?: string): void {
    if (start && end && new Date(end) < new Date(start)) {
      throw new ValidationException(
        'scheduledEnd must be after scheduledStart',
      );
    }
  }
}
