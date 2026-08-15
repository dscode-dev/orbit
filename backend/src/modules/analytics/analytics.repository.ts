import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';
import { EntityNotFoundException } from '../../exceptions';
import type { AnalyticsRange, AnalyticsSnapshot } from './analytics.types';

const operationSelect = {
  id: true,
  status: true,
  scheduledEnd: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  users: { select: { user: { select: { id: true, displayName: true } } } },
} satisfies Prisma.OperationSelect;

/**
 * Read-only aggregation boundary. Every read executes in the tenant RLS
 * transaction; Analytics never owns or persists facts.
 */
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly rls: RlsTransaction) {}

  snapshot(
    organizationId: string,
    range: AnalyticsRange,
  ): Promise<AnalyticsSnapshot> {
    return this.rls.run(async (tx) => {
      const scope = {
        organizationId,
        deletedAt: null,
        businessUnitId: range.businessUnitId,
      };
      /**
       * Seis consultas, uma de cada vez.
       *
       * Elas dividem o **mesmo cliente transacional**, e um cliente `pg`
       * atende uma consulta por vez: disparar as seis juntas não as tornava
       * paralelas — enfileirava-as no driver e ainda prendia a conexão por
       * todo o intervalo, com o relógio da transação correndo. Ver
       * `docs/transaction-concurrency.md`.
       */
      const organization = await tx.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: { id: true, primarySegment: true },
      });
      const operations = await tx.operation.findMany({
        where: { ...scope, createdAt: { gte: range.from, lte: range.to } },
        select: operationSelect,
        orderBy: { createdAt: 'asc' },
      });
      const previousOperations = await tx.operation.findMany({
        where: {
          ...scope,
          createdAt: { gte: range.previousFrom, lte: range.previousTo },
        },
        select: operationSelect,
        orderBy: { createdAt: 'asc' },
      });
      /**
       * PMOC vem do **domínio de PMOC**, não do documento (PR-26).
       *
       * Até aqui, o indicador era derivado de `reports` cujo template tinha
       * "PMOC" no nome — o que media quantos PDFs foram preenchidos, e não se
       * a manutenção aconteceu. Agora mede o ciclo: previsto, cumprido, e
       * quando. O formato devolvido é o mesmo, então os motores de KPI e de
       * tendência não mudam.
       */
      const pmocs = await tx.pmocExecution
        .findMany({
          where: {
            organizationId,
            plan: {
              businessUnitId: range.businessUnitId,
              deletedAt: null,
            },
            dueOn: { gte: range.from, lte: range.to },
          },
          select: { status: true, dueOn: true, performedAt: true },
        })
        .then((rows) =>
          rows.map((row) => ({
            status: row.status,
            createdAt: row.dueOn,
            finalizedAt: row.performedAt,
          })),
        );
      const assets = await tx.asset.findMany({
        where: {
          organizationId,
          businessUnitId: range.businessUnitId,
          deletedAt: null,
        },
        select: { status: true },
      });
      const customers = await tx.customer.findMany({
        where: { organizationId, deletedAt: null },
        select: { status: true },
      });
      if (!organization)
        throw new EntityNotFoundException('Organization', organizationId);
      return {
        organization: {
          id: organization.id,
          segment: organization.primarySegment,
        },
        range,
        operations,
        previousOperations,
        pmocs,
        assets,
        customers,
      };
    });
  }
}
