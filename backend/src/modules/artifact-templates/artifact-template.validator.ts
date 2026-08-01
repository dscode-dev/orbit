import { Injectable } from '@nestjs/common';
import { ValidationException } from '../../exceptions';
import type {
  ArtifactSectionDto,
  ArtifactSignatureSlotDto,
} from './dto/artifact-template.dto';

/** Validates structural invariants without interpreting field metadata/rules. */
@Injectable()
export class ArtifactTemplateValidator {
  validate(
    sections: readonly ArtifactSectionDto[],
    signatures: readonly ArtifactSignatureSlotDto[],
  ): void {
    this.unique(
      sections.map((section) => section.id),
      'section ids',
    );
    this.unique(
      sections.map((section) => String(section.order)),
      'section order values',
    );
    this.unique(
      signatures.map((slot) => slot.id),
      'signature slot ids',
    );
    this.unique(
      signatures.map((slot) => String(slot.order)),
      'signature slot order values',
    );
    for (const section of sections) {
      this.unique(
        section.fields.map((field) => field.id),
        `field ids in section ${section.id}`,
      );
      this.unique(
        section.fields.map((field) => String(field.order)),
        `field order values in section ${section.id}`,
      );
    }
    this.serializable({ sections, signatures });
  }

  private unique(values: readonly string[], label: string): void {
    if (new Set(values).size !== values.length) {
      throw new ValidationException(`Duplicate ${label}`);
    }
  }

  private serializable(value: unknown): void {
    try {
      JSON.stringify(value);
    } catch {
      throw new ValidationException(
        'Artifact template metadata must be JSON serializable',
      );
    }
  }
}
