import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, RlsTransaction } from '../../database';
import { generateUuidV7 } from '../../utils';
import type { CreateOrganizationDto } from './dto/organization.dto';

const organizationView = {
  plan: true,
  businessUnits: {
    where: { deletedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.OrganizationInclude;

/** Projeção única do papel — o que `listRoles`, `createRole` e `updateRole` devolvem. */
const ROLE_VIEW = {
  id: true,
  key: true,
  name: true,
  description: true,
  permissions: true,
  isSystem: true,
  organizationId: true,
  _count: { select: { organizationMemberships: true } },
} satisfies Prisma.RoleSelect;

@Injectable()
export class OrganizationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rls: RlsTransaction,
  ) {}

  findPlanByKey(key: string) {
    return this.prisma.plan.findFirst({ where: { key, isActive: true } });
  }

  create(
    ownerUserId: string,
    input: CreateOrganizationDto,
    slug: string,
    businessUnitSlug: string,
  ) {
    const organizationId = generateUuidV7();
    const businessUnitId = generateUuidV7();
    const trialStartedAt = new Date();
    const trialEndsAt = new Date(trialStartedAt);
    trialEndsAt.setUTCDate(trialEndsAt.getUTCDate() + 14);

    return this.prisma.$transaction(async (transaction) => {
      const plan = await transaction.plan.findFirst({
        where: { key: input.planKey, isActive: true },
      });
      if (!plan) return null;
      await this.setLocal(transaction, 'app.user_id', ownerUserId);
      await this.setLocal(transaction, 'app.organization_id', organizationId);
      await this.setLocal(transaction, 'app.business_unit_id', businessUnitId);
      await this.setLocal(transaction, 'app.business_unit_ids', businessUnitId);

      await transaction.organization.create({
        data: {
          id: organizationId,
          ownerUserId,
          planId: plan.id,
          slug,
          displayName: input.displayName,
          primarySegment: input.primarySegment,
          status: 'ACTIVE',
          subscriptionStatus: 'TRIALING',
          subscriptionStartedAt: trialStartedAt,
          currentPeriodStart: trialStartedAt,
          currentPeriodEnd: trialEndsAt,
        },
      });
      const ownerRole = await transaction.role.create({
        data: {
          organizationId,
          key: 'OWNER',
          name: 'Owner',
          description: 'Organization owner',
          permissions: ['*'],
        },
      });
      await transaction.businessUnit.create({
        data: {
          id: businessUnitId,
          organizationId,
          slug: businessUnitSlug,
          isPrimary: true,
          legalName: input.primaryBusinessUnit.legalName,
          tradeName: input.primaryBusinessUnit.tradeName,
          code: input.primaryBusinessUnit.code,
          type: input.primaryBusinessUnit.type,
          documentType: input.primaryBusinessUnit.documentType,
          documentNumber: input.primaryBusinessUnit.documentNumber,
          city: input.primaryBusinessUnit.city,
          street: input.primaryBusinessUnit.street,
          number: input.primaryBusinessUnit.number,
          stateCode: input.primaryBusinessUnit.stateCode,
          postalCode: input.primaryBusinessUnit.postalCode,
          email: input.primaryBusinessUnit.email,
          phone: input.primaryBusinessUnit.phone,
        },
      });
      await transaction.organizationMembership.create({
        data: { organizationId, userId: ownerUserId, roleId: ownerRole.id },
      });
      await transaction.businessUnitMembership.create({
        data: {
          organizationId,
          businessUnitId,
          userId: ownerUserId,
          roleId: ownerRole.id,
        },
      });
      return transaction.organization.findUniqueOrThrow({
        where: { id: organizationId },
        include: organizationView,
      });
    });
  }

  findCurrent(id: string) {
    return this.rls.run((transaction) =>
      transaction.organization.findUnique({
        where: { id, deletedAt: null },
        include: organizationView,
      }),
    );
  }

  /**
   * Membros ativos e suspensos da organização.
   *
   * Associações removidas (`deletedAt`) ficam de fora — quem saiu não pode
   * receber trabalho novo. O status da associação é publicado para que o
   * cliente distinga quem está ativo de quem está suspenso sem inferir nada.
   */
  /**
   * Papéis da organização.
   *
   * **Só os próprios.** Papéis globais (`organizationId: null`) são de
   * plataforma — hoje apenas `PLATFORM_ADMIN`, atribuído por
   * `PlatformRoleAssignment`, uma tabela que nada tem a ver com a associação
   * de um tenant. Listá-lo aqui mostraria ao gestor um papel que ele não pode
   * conceder e que não descreve ninguém da equipe dele.
   */
  listRoles(organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.role.findMany({
        where: { organizationId, deletedAt: null },
        select: ROLE_VIEW,
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      }),
    );
  }

  /**
   * Unidades de cada pessoa.
   *
   * `BusinessUnitMembership` já existia e nunca foi publicada. Sem ela, a
   * equipe aparece como uma lista plana e não há como saber quem atende qual
   * unidade — que é a primeira pergunta de quem escala trabalho.
   */
  listBusinessUnitMemberships(organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.businessUnitMembership.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          userId: true,
          businessUnit: {
            select: { id: true, legalName: true, tradeName: true },
          },
        },
      }),
    );
  }

  findMembership(organizationId: string, userId: string) {
    return this.rls.run((transaction) =>
      transaction.organizationMembership.findFirst({
        where: { organizationId, userId, deletedAt: null },
      }),
    );
  }

  updateMembership(
    id: string,
    data: { roleId?: string; status?: string },
  ) {
    return this.rls.run((transaction) =>
      transaction.organizationMembership.update({
        where: { id },
        data,
        select: {
          userId: true,
          status: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              avatarUrl: true,
              status: true,
            },
          },
          role: { select: { id: true, key: true, name: true } },
        },
      }),
    );
  }

  findRole(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.role.findFirst({
        where: { id, organizationId, deletedAt: null },
      }),
    );
  }

  createRole(data: Prisma.RoleUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.role.create({
        data,
        select: ROLE_VIEW,
      }),
    );
  }

  updateRole(id: string, data: Prisma.RoleUpdateInput) {
    return this.rls.run((transaction) =>
      transaction.role.update({ where: { id }, data, select: ROLE_VIEW }),
    );
  }

  /** Quantas pessoas ainda dependem deste papel — o servidor recusa remover. */
  roleDependencies(id: string) {
    return this.rls.run(async (transaction) => {
      const [members, invitations] = await Promise.all([
        transaction.organizationMembership.count({
          where: { roleId: id, deletedAt: null },
        }),
        transaction.identityInvitation.count({
          where: { roleId: id, status: 'PENDING' },
        }),
      ]);
      return { members, invitations };
    });
  }

  softDeleteRole(id: string): Promise<void> {
    return this.rls
      .run((transaction) =>
        transaction.role.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      )
      .then(() => undefined);
  }

  countMembers(organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.organizationMembership.count({
        where: { organizationId, deletedAt: null },
      }),
    );
  }

  listMembers(organizationId: string, pagination?: { skip: number; take: number }) {
    return this.rls.run((transaction) =>
      transaction.organizationMembership.findMany({
        where: { organizationId, deletedAt: null },
        ...(pagination ?? {}),
        select: {
          userId: true,
          status: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              avatarUrl: true,
              status: true,
            },
          },
          role: { select: { id: true, key: true, name: true } },
        },
        orderBy: { user: { displayName: 'asc' } },
      }),
    );
  }

  updateCurrent(id: string, data: Prisma.OrganizationUpdateInput) {
    return this.rls.run((transaction) =>
      transaction.organization.update({
        where: { id },
        data,
        include: organizationView,
      }),
    );
  }

  private setLocal(
    transaction: Prisma.TransactionClient,
    key: string,
    value: string,
  ): Promise<unknown> {
    return transaction.$queryRawUnsafe(
      'SELECT set_config($1, $2, true)',
      key,
      value,
    );
  }
}
