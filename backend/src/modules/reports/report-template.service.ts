import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../exceptions';
import type {
  DocumentSettings,
  DocumentSection,
  SignatureSlot,
} from '../document-engine/document-engine.types';
import { PdfRendererService } from '../document-engine/pdf-renderer.service';
import type {
  CreateReportTemplateDto,
  CreateReportTemplateVersionDto,
  PreviewReportTemplateDto,
  ReportTemplateQueryDto,
  UpdateReportTemplateDto,
} from './dto/report-template.dto';
import { ReportTemplateRepository } from './report-template.repository';

@Injectable()
export class ReportTemplateService {
  constructor(
    private readonly repository: ReportTemplateRepository,
    private readonly renderer: PdfRendererService,
  ) {}

  list(organizationId: string, query: ReportTemplateQueryDto) {
    return this.repository.list(organizationId, query);
  }

  async get(id: string, organizationId: string) {
    const template = await this.repository.find(id, organizationId);
    if (!template) throw new EntityNotFoundException('Report template', id);
    return template;
  }

  async create(organizationId: string, input: CreateReportTemplateDto) {
    this.validateStructure(input.sections, input.signatureSlots ?? []);
    try {
      return await this.repository.create({
        organizationId,
        key: input.key.trim().toUpperCase(),
        name: input.name,
        description: input.description,
        reportKind: input.reportKind.trim().toUpperCase(),
        sections: input.sections as unknown as Prisma.InputJsonValue,
        signatureSlots: (input.signatureSlots ??
          []) as unknown as Prisma.InputJsonValue,
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
        isDefault: input.isDefault,
      });
    } catch (error) {
      this.mapConflict(error);
    }
  }

  async createVersion(
    id: string,
    organizationId: string,
    input: CreateReportTemplateVersionDto,
  ) {
    const source = await this.get(id, organizationId);
    this.validateStructure(input.sections, input.signatureSlots ?? []);
    try {
      return await this.repository.createVersion(source, {
        ...input,
        sections: this.json(input.sections),
        signatureSlots: this.json(input.signatureSlots ?? []),
        settings: (input.settings ?? {}) as Prisma.InputJsonValue,
      });
    } catch (error) {
      this.mapConflict(error);
    }
  }

  async update(
    id: string,
    organizationId: string,
    input: UpdateReportTemplateDto,
  ) {
    const current = await this.get(id, organizationId);
    return this.repository.update(id, organizationId, current.reportKind, {
      name: input.name,
      description: input.description,
      isDefault: input.isActive === false ? false : input.isDefault,
      isActive: input.isActive,
    });
  }

  async preview(
    id: string,
    organizationId: string,
    input: PreviewReportTemplateDto,
  ) {
    const template = await this.get(id, organizationId);
    return this.renderer.render({
      title: template.name,
      code: `${template.key}-PREVIEW`,
      version: template.version,
      sections: template.sections as unknown as DocumentSection[],
      signatureSlots: template.signatureSlots as unknown as SignatureSlot[],
      settings: template.settings as unknown as DocumentSettings,
      data: input.data ?? {},
      signatures: [],
      contentHash: 'PREVIEW-NOT-SIGNED',
    });
  }

  async remove(id: string, organizationId: string): Promise<void> {
    await this.get(id, organizationId);
    const dependencies = await this.repository.dependencies(id);
    if (dependencies > 0) {
      throw new ConflictException(
        'A template version used by reports cannot be deleted',
      );
    }
    await this.repository.softDelete(id);
  }

  private validateStructure(
    sections: {
      key: string;
      type: string;
      order: number;
      content?: string;
      fields?: unknown[];
      columns?: unknown[];
      dataPath?: string;
    }[],
    slots: { key: string; order: number }[],
  ) {
    this.unique(
      sections.map((section) => section.key),
      'Section keys must be unique',
    );
    this.unique(
      sections.map((section) => String(section.order)),
      'Section order values must be unique',
    );
    this.unique(
      slots.map((slot) => slot.key),
      'Signature slot keys must be unique',
    );
    this.unique(
      slots.map((slot) => String(slot.order)),
      'Signature slot order values must be unique',
    );
    for (const section of sections) {
      if (
        ['TEXT', 'HEADING'].includes(section.type) &&
        !section.content?.trim()
      ) {
        throw new ValidationException(
          `Section ${section.key} requires content`,
        );
      }
      if (section.type === 'KEY_VALUE' && !section.fields?.length) {
        throw new ValidationException(`Section ${section.key} requires fields`);
      }
      if (
        section.type === 'TABLE' &&
        (!section.columns?.length || !section.dataPath)
      ) {
        throw new ValidationException(
          `Section ${section.key} requires columns and dataPath`,
        );
      }
    }
  }

  private unique(values: string[], message: string) {
    if (new Set(values).size !== values.length) {
      throw new ValidationException(message);
    }
  }

  private mapConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Report template version already exists');
    }
    throw error;
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
