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
      const [
        organization,
        operations,
        previousOperations,
        pmocs,
        assets,
        customers,
      ] = await Promise.all([
        tx.organization.findFirst({
          where: { id: organizationId, deletedAt: null },
          select: { id: true, primarySegment: true },
        }),
        tx.operation.findMany({
          where: { ...scope, createdAt: { gte: range.from, lte: range.to } },
          select: operationSelect,
          orderBy: { createdAt: 'asc' },
        }),
        tx.operation.findMany({
          where: {
            ...scope,
            createdAt: { gte: range.previousFrom, lte: range.previousTo },
          },
          select: operationSelect,
          orderBy: { createdAt: 'asc' },
        }),
        tx.report.findMany({
          where: {
            organizationId,
            businessUnitId: range.businessUnitId,
            deletedAt: null,
            createdAt: { gte: range.from, lte: range.to },
            template: { reportKind: { contains: 'PMOC', mode: 'insensitive' } },
          },
          select: { status: true, createdAt: true, finalizedAt: true },
        }),
        tx.asset.findMany({
          where: {
            organizationId,
            businessUnitId: range.businessUnitId,
            deletedAt: null,
          },
          select: { status: true },
        }),
        tx.customer.findMany({
          where: { organizationId, deletedAt: null },
          select: { status: true },
        }),
      ]);
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
