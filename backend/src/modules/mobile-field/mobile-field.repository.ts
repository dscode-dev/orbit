/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@nestjs/common';
import { RlsTransaction } from '../../database';

export interface MobileFieldProjectionSource {
  businessUnits: readonly any[];
  operations: readonly any[];
  pmocCycles: readonly any[];
  rvtOccurrences: readonly any[];
  customers: readonly any[];
  rvtAssets: readonly any[];
}

@Injectable()
export class MobileFieldRepository {
  constructor(private readonly rls: RlsTransaction) {}

  /**
   * Documentos de campo emitidos recentemente nas unidades do técnico.
   *
   * Lê `field_artifacts` pelo índice `(organização, unidade, criado em)` — uma
   * consulta, e não uma por atendimento. O aplicativo montava isso pedindo o
   * contexto documental de cada item da fila, que é exatamente a cascata que
   * esta leitura existe para eliminar.
   */
  recentDocuments(
    organizationId: string,
    businessUnitIds: readonly string[],
    take: number,
  ) {
    if (businessUnitIds.length === 0) return Promise.resolve([]);
    return this.rls.run((tx) =>
      tx.fieldArtifact.findMany({
        where: {
          organizationId,
          businessUnitId: { in: [...businessUnitIds] },
        },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          documentType: true,
          createdAt: true,
          artifactExecution: {
            select: {
              renderStatus: true,
              customer: { select: { legalName: true, tradeName: true } },
            },
          },
        },
      }),
    );
  }

  /**
   * Uma página de documentos, na ordem em que foram emitidos.
   *
   * Ordena por `createdAt desc` com desempate por `id`: dois documentos
   * emitidos no mesmo milissegundo — o que acontece quando uma execução gera
   * mais de um — precisam de ordem total, senão a mesma linha aparece em duas
   * páginas.
   */
  documentsPage(
    organizationId: string,
    businessUnitIds: readonly string[],
    options: { type?: string; take: number; cursorId?: string },
  ) {
    if (businessUnitIds.length === 0) return Promise.resolve([]);
    return this.rls.run((tx) =>
      tx.fieldArtifact.findMany({
        where: {
          organizationId,
          businessUnitId: { in: [...businessUnitIds] },
          ...(options.type ? { documentType: options.type } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: options.take,
        ...(options.cursorId
          ? { cursor: { id: options.cursorId }, skip: 1 }
          : {}),
        select: {
          id: true,
          documentType: true,
          createdAt: true,
          artifactExecution: {
            select: {
              renderStatus: true,
              customer: { select: { legalName: true, tradeName: true } },
            },
          },
        },
      }),
    );
  }

  /** Compromissos recentes da agenda, nas unidades do técnico. */
  recentAppointments(
    organizationId: string,
    businessUnitIds: readonly string[],
    take: number,
  ) {
    if (businessUnitIds.length === 0) return Promise.resolve([]);
    return this.rls.run((tx) =>
      tx.schedulingEvent.findMany({
        where: {
          organizationId,
          businessUnitId: { in: [...businessUnitIds] },
          deletedAt: null,
        },
        orderBy: { startsAt: 'desc' },
        take,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          startsAt: true,
          customer: { select: { legalName: true, tradeName: true } },
        },
      }),
    );
  }

  project(
    organizationId: string,
    actorId: string,
    businessUnitIds: readonly string[],
  ): Promise<MobileFieldProjectionSource> {
    return this.rls.run(async (tx) => {
      const businessUnits = await tx.businessUnit.findMany({
        where: {
          organizationId,
          id: { in: [...businessUnitIds] },
          deletedAt: null,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          legalName: true,
          tradeName: true,
          timezone: true,
        },
      });
      const scopedIds = businessUnits.map((unit) => unit.id);
      if (!scopedIds.length)
        return {
          businessUnits,
          operations: [],
          pmocCycles: [],
          rvtOccurrences: [],
          customers: [],
          rvtAssets: [],
        };

      const operations = await tx.operation.findMany({
        where: {
          organizationId,
          businessUnitId: { in: scopedIds },
          deletedAt: null,
          OR: [
            { responsibleFieldTechnicianId: actorId },
            {
              auxiliaryTechnicians: {
                some: { userId: actorId, removedAt: null },
              },
            },
          ],
        },
        take: 500,
        orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          businessUnitId: true,
          customerId: true,
          assetId: true,
          code: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          scheduledStart: true,
          scheduledEnd: true,
          startedAt: true,
          completedAt: true,
          location: true,
          updatedAt: true,
          responsibleFieldTechnician: {
            select: { id: true, displayName: true },
          },
          auxiliaryTechnicians: {
            where: { removedAt: null },
            select: { user: { select: { id: true, displayName: true } } },
          },
          asset: {
            select: {
              id: true,
              identifier: true,
              name: true,
              category: true,
              manufacturer: true,
              model: true,
              location: true,
              status: true,
              qrIdentities: {
                where: { status: 'ACTIVE', revokedAt: null },
                take: 1,
                select: { id: true },
              },
            },
          },
          artifactExecutions: {
            where: { status: { in: ['APPROVED', 'COMPLETED', 'ARCHIVED'] } },
            take: 10,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              status: true,
              renderStatus: true,
              snapshot: { select: { artifactType: true } },
            },
          },
          checklistExecutions: {
            take: 20,
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              status: true,
              template: { select: { name: true } },
            },
          },
        },
      });

      const pmocCycles = await tx.pmocExecution.findMany({
        where: {
          organizationId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          plan: {
            businessUnitId: { in: scopedIds },
            status: 'ACTIVE',
            schedulingPaused: false,
            OR: [
              {
                technicianUserId: actorId,
                technician: {
                  professionalProfiles: {
                    some: {
                      organizationId,
                      active: true,
                      fieldTechnicianEnabled: true,
                    },
                  },
                },
              },
              {
                executions: {
                  some: {
                    equipmentExecutions: {
                      some: { responsibleFieldTechnicianId: actorId },
                    },
                  },
                },
              },
            ],
          },
        },
        take: 300,
        orderBy: [{ dueOn: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          dueOn: true,
          status: true,
          schedulingEventId: true,
          updatedAt: true,
          artifactExecution: {
            select: {
              id: true,
              status: true,
              renderStatus: true,
              snapshot: { select: { artifactType: true } },
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              code: true,
              businessUnitId: true,
              customerId: true,
              serviceLocation: true,
              technician: { select: { id: true, displayName: true } },
              technicalResponsibleUserId: true,
              coverages: {
                where: { deletedAt: null },
                take: 100,
                select: {
                  id: true,
                  asset: {
                    select: {
                      id: true,
                      identifier: true,
                      name: true,
                      category: true,
                      manufacturer: true,
                      model: true,
                      location: true,
                      status: true,
                      qrIdentities: {
                        where: { status: 'ACTIVE', revokedAt: null },
                        take: 1,
                        select: { id: true },
                      },
                    },
                  },
                },
              },
            },
          },
          equipmentExecutions: {
            select: {
              id: true,
              coverageId: true,
              status: true,
              responsibleFieldTechnician: {
                select: { id: true, displayName: true },
              },
              operation: {
                select: {
                  auxiliaryTechnicians: {
                    where: { removedAt: null },
                    select: {
                      user: { select: { id: true, displayName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const rvtOccurrences = await tx.rvtOccurrence.findMany({
        where: {
          organizationId,
          businessUnitId: { in: scopedIds },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          OR: [
            { configuration: { defaultResponsibleFieldTechnicianId: actorId } },
            { execution: { responsibleFieldTechnicianId: actorId } },
          ],
        },
        take: 300,
        orderBy: [{ scheduledFor: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          businessUnitId: true,
          scheduledFor: true,
          status: true,
          schedulingEventId: true,
          updatedAt: true,
          configuration: {
            select: {
              id: true,
              name: true,
              visitType: true,
              customerId: true,
              serviceLocation: true,
              timezone: true,
              defaultResponsibleFieldTechnicianId: true,
              equipment: {
                where: { removedAt: null },
                take: 100,
                select: { assetId: true },
              },
            },
          },
          execution: {
            select: {
              id: true,
              status: true,
              artifactExecutionId: true,
              responsibleFieldTechnicianId: true,
            },
          },
        },
      });

      const customerIds = new Set<string>();
      operations.forEach(
        (item) => item.customerId && customerIds.add(item.customerId),
      );
      pmocCycles.forEach((item) => customerIds.add(item.plan.customerId));
      rvtOccurrences.forEach((item) =>
        customerIds.add(item.configuration.customerId),
      );
      const customers = await tx.customer.findMany({
        where: {
          organizationId,
          id: { in: [...customerIds] },
          deletedAt: null,
        },
        select: {
          id: true,
          legalName: true,
          tradeName: true,
          address: true,
          contacts: {
            where: { deletedAt: null },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            take: 1,
            select: { name: true, phone: true, email: true },
          },
        },
      });
      const rvtAssetIds = rvtOccurrences.flatMap((item) =>
        item.configuration.equipment.map((equipment) => equipment.assetId),
      );
      const rvtAssets = await tx.asset.findMany({
        where: {
          organizationId,
          businessUnitId: { in: scopedIds },
          id: { in: rvtAssetIds },
          deletedAt: null,
        },
        select: {
          id: true,
          identifier: true,
          name: true,
          category: true,
          manufacturer: true,
          model: true,
          location: true,
          status: true,
          qrIdentities: {
            where: { status: 'ACTIVE', revokedAt: null },
            take: 1,
            select: { id: true },
          },
        },
      });
      return {
        businessUnits,
        operations,
        pmocCycles,
        rvtOccurrences,
        customers,
        rvtAssets,
      };
    });
  }
}
