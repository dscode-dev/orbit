import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';
import type { ReportTemplateQueryDto } from './dto/report-template.dto';

@Injectable()
export class ReportTemplateRepository {
  constructor(private readonly rls: RlsTransaction) {}

  list(organizationId: string, query: ReportTemplateQueryDto) {
    return this.rls.run((transaction) =>
      transaction.reportTemplate.findMany({
        where: {
          organizationId,
          deletedAt: null,
          reportKind: query.reportKind,
          isActive: query.active,
          ...(query.search
            ? {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { key: { contains: query.search, mode: 'insensitive' } },
                  {
                    description: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                ],
              }
            : {}),
        },
        orderBy: [{ reportKind: 'asc' }, { key: 'asc' }, { version: 'desc' }],
      }),
    );
  }

  find(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.reportTemplate.findFirst({
        where: { id, organizationId, deletedAt: null },
      }),
    );
  }

  create(data: Prisma.ReportTemplateUncheckedCreateInput) {
    return this.rls.run(async (transaction) => {
      if (data.isDefault) {
        await transaction.reportTemplate.updateMany({
          where: {
            organizationId: data.organizationId,
            reportKind: data.reportKind,
            deletedAt: null,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }
      return transaction.reportTemplate.create({ data });
    });
  }

  createVersion(
    source: {
      organizationId: string;
      key: string;
      reportKind: string;
      name: string;
      description: string | null;
    },
    data: {
      name?: string;
      description?: string;
      sections: Prisma.InputJsonValue;
      signatureSlots: Prisma.InputJsonValue;
      settings: Prisma.InputJsonValue;
      isDefault?: boolean;
    },
  ) {
    return this.rls.run(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${source.organizationId}:${source.key}`}))`;
      const latest = await transaction.reportTemplate.aggregate({
        where: {
          organizationId: source.organizationId,
          key: source.key,
          deletedAt: null,
        },
        _max: { version: true },
      });
      if (data.isDefault) {
        await transaction.reportTemplate.updateMany({
          where: {
            organizationId: source.organizationId,
            reportKind: source.reportKind,
            deletedAt: null,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }
      return transaction.reportTemplate.create({
        data: {
          organizationId: source.organizationId,
          key: source.key,
          reportKind: source.reportKind,
          name: data.name ?? source.name,
          description: data.description ?? source.description,
          version: (latest._max.version ?? 0) + 1,
          sections: data.sections,
          signatureSlots: data.signatureSlots,
          settings: data.settings,
          isDefault: data.isDefault ?? false,
        },
      });
    });
  }

  update(
    id: string,
    organizationId: string,
    reportKind: string,
    data: Prisma.ReportTemplateUpdateInput,
  ) {
    return this.rls.run(async (transaction) => {
      if (data.isDefault === true) {
        await transaction.reportTemplate.updateMany({
          where: {
            id: { not: id },
            organizationId,
            reportKind,
            deletedAt: null,
            isDefault: true,
          },
          data: { isDefault: false },
        });
      }
      return transaction.reportTemplate.update({ where: { id }, data });
    });
  }

  dependencies(id: string) {
    return this.rls.run((transaction) =>
      transaction.report.count({
        where: { templateId: id, deletedAt: null },
      }),
    );
  }

  softDelete(id: string): Promise<void> {
    return this.rls
      .run((transaction) =>
        transaction.reportTemplate.update({
          where: { id },
          data: { deletedAt: new Date(), isActive: false, isDefault: false },
        }),
      )
      .then(() => undefined);
  }
}
