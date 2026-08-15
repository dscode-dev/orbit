import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';
import { PaginationHelper } from '../../database/helpers/database.helpers';
import type { NotificationQueryDto } from './notification.dto';

@Injectable()
export class NotificationRepository {
  constructor(private readonly rls: RlsTransaction) {}

  list(organizationId: string, userId: string, query: NotificationQueryDto) {
    const pagination = PaginationHelper.normalize(query.page, query.limit);
    const where: Prisma.NotificationWhereInput = {
      organizationId,
      recipientUserId: userId,
      status: query.status,
      type: query.type,
      readAt: query.unreadOnly ? null : undefined,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
    return this.rls.run(async (tx) => {
      const data = await tx.notification.findMany({
        where,
        include: { deliveries: true },
        orderBy: { createdAt: 'desc' },
        ...PaginationHelper.toPrisma(pagination),
      });
      const total = await tx.notification.count({ where });
      const unread = await tx.notification.count({
        where: {
          organizationId,
          recipientUserId: userId,
          readAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      return { ...PaginationHelper.result(data, total, pagination), unread };
    });
  }

  find(id: string, organizationId: string, userId?: string) {
    return this.rls.run((tx) =>
      tx.notification.findFirst({
        where: { id, organizationId, recipientUserId: userId },
        include: {
          recipient: { select: { id: true, email: true, displayName: true } },
          deliveries: true,
        },
      }),
    );
  }

  findRecipient(
    userId: string,
    organizationId: string,
    businessUnitId?: string,
  ) {
    return this.rls.run((tx) =>
      tx.organizationMembership.findFirst({
        where: {
          organizationId,
          userId,
          status: 'ACTIVE',
          deletedAt: null,
          user: { deletedAt: null, status: 'ACTIVE' },
          ...(businessUnitId
            ? {
                user: {
                  deletedAt: null,
                  status: 'ACTIVE',
                  businessUnitMemberships: {
                    some: {
                      organizationId,
                      businessUnitId,
                      status: 'ACTIVE',
                      deletedAt: null,
                    },
                  },
                },
              }
            : {}),
        },
        include: { user: true },
      }),
    );
  }

  preference(organizationId: string, userId: string, type: string) {
    return this.rls.run((tx) =>
      tx.notificationPreference.findUnique({
        where: { organizationId_userId_type: { organizationId, userId, type } },
      }),
    );
  }

  preferences(organizationId: string, userId: string) {
    return this.rls.run((tx) =>
      tx.notificationPreference.findMany({
        where: { organizationId, userId },
        orderBy: { type: 'asc' },
      }),
    );
  }

  upsertPreference(
    organizationId: string,
    userId: string,
    type: string,
    data: Pick<
      Prisma.NotificationPreferenceUncheckedCreateInput,
      'channels' | 'enabled' | 'quietHours'
    >,
  ) {
    return this.rls.run((tx) =>
      tx.notificationPreference.upsert({
        where: { organizationId_userId_type: { organizationId, userId, type } },
        create: { organizationId, userId, type, ...data },
        update: data,
      }),
    );
  }

  create(data: Prisma.NotificationUncheckedCreateInput, channels: string[]) {
    return this.rls.run((tx) =>
      tx.notification.create({
        data: {
          ...data,
          deliveries: {
            create: channels.map((channel) => ({
              recipientUserId: data.recipientUserId,
              channel,
            })),
          },
        },
        include: {
          recipient: { select: { id: true, email: true, displayName: true } },
          deliveries: true,
        },
      }),
    );
  }

  updateDelivery(id: string, data: Prisma.NotificationDeliveryUpdateInput) {
    return this.rls.run((tx) =>
      tx.notificationDelivery.update({ where: { id }, data }),
    );
  }

  markSent(id: string, status: string) {
    return this.rls.run((tx) =>
      tx.notification.update({
        where: { id },
        data: { status, sentAt: status === 'SENT' ? new Date() : undefined },
      }),
    );
  }

  markRead(id: string, organizationId: string, userId: string) {
    return this.rls.run((tx) =>
      tx.notification.updateMany({
        where: { id, organizationId, recipientUserId: userId, readAt: null },
        data: { readAt: new Date() },
      }),
    );
  }

  markAllRead(organizationId: string, userId: string) {
    return this.rls.run((tx) =>
      tx.notification.updateMany({
        where: { organizationId, recipientUserId: userId, readAt: null },
        data: { readAt: new Date() },
      }),
    );
  }

  subscriptions(organizationId: string, userId: string) {
    return this.rls.run((tx) =>
      tx.pushSubscription.findMany({
        where: {
          organizationId,
          userId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),
    );
  }

  upsertSubscription(data: Prisma.PushSubscriptionUncheckedCreateInput) {
    return this.rls.run((tx) =>
      tx.pushSubscription.upsert({
        where: {
          organizationId_userId_endpointHash: {
            organizationId: data.organizationId,
            userId: data.userId,
            endpointHash: data.endpointHash,
          },
        },
        create: data,
        update: {
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          userAgent: data.userAgent,
          expiresAt: data.expiresAt,
          revokedAt: null,
        },
        omit: { p256dh: true, auth: true },
      }),
    );
  }

  revokeSubscription(
    organizationId: string,
    userId: string,
    endpointHash: string,
  ) {
    return this.rls.run((tx) =>
      tx.pushSubscription.updateMany({
        where: { organizationId, userId, endpointHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    );
  }
}
