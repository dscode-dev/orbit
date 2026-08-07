import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RlsTransaction } from '../../database';

const specialtyView = {
  id: true,
  name: true,
  slug: true,
  description: true,
  color: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { members: { where: { deletedAt: null } } } },
} satisfies Prisma.SpecialtySelect;

const teamView = {
  id: true,
  name: true,
  slug: true,
  description: true,
  color: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  businessUnit: { select: { id: true, legalName: true, tradeName: true } },
  leader: { select: { id: true, displayName: true } },
  members: {
    where: { deletedAt: null },
    select: {
      userId: true,
      role: true,
      joinedAt: true,
      user: {
        select: { id: true, displayName: true, email: true, avatarUrl: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  },
} satisfies Prisma.TeamSelect;

@Injectable()
export class WorkforceRepository {
  constructor(private readonly rls: RlsTransaction) {}

  /* ---------------------------------------------------------------- */
  /* Especialidades                                                    */
  /* ---------------------------------------------------------------- */

  listSpecialties(organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.specialty.findMany({
        where: { organizationId, deletedAt: null },
        select: specialtyView,
        orderBy: { name: 'asc' },
      }),
    );
  }

  findSpecialty(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.specialty.findFirst({
        where: { id, organizationId, deletedAt: null },
      }),
    );
  }

  createSpecialty(data: Prisma.SpecialtyUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.specialty.create({ data, select: specialtyView }),
    );
  }

  updateSpecialty(id: string, data: Prisma.SpecialtyUpdateInput) {
    return this.rls.run((transaction) =>
      transaction.specialty.update({ where: { id }, data, select: specialtyView }),
    );
  }

  softDeleteSpecialty(id: string): Promise<void> {
    return this.rls
      .run((transaction) =>
        transaction.specialty.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      )
      .then(() => undefined);
  }

  specialtyAssignments(id: string) {
    return this.rls.run((transaction) =>
      transaction.memberSpecialty.count({
        where: { specialtyId: id, deletedAt: null },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Especialidades de membros                                         */
  /* ---------------------------------------------------------------- */

  listMemberSpecialties(organizationId: string, userId?: string) {
    return this.rls.run((transaction) =>
      transaction.memberSpecialty.findMany({
        where: { organizationId, userId, deletedAt: null },
        select: {
          id: true,
          userId: true,
          level: true,
          notes: true,
          specialty: {
            select: { id: true, name: true, slug: true, color: true },
          },
        },
        orderBy: { specialty: { name: 'asc' } },
      }),
    );
  }

  /**
   * Vincula ou revive um vínculo.
   *
   * `@@unique([userId, specialtyId])` impede duplicidade, mas um vínculo
   * removido antes ainda ocupa a chave — daí o `upsert`, que revive em vez de
   * falhar com 409 por um registro que o usuário não vê.
   */
  upsertMemberSpecialty(input: {
    organizationId: string;
    userId: string;
    specialtyId: string;
    level: string;
    notes?: string;
  }) {
    return this.rls.run((transaction) =>
      transaction.memberSpecialty.upsert({
        where: {
          userId_specialtyId: {
            userId: input.userId,
            specialtyId: input.specialtyId,
          },
        },
        create: input,
        update: { level: input.level, notes: input.notes, deletedAt: null },
        select: {
          id: true,
          userId: true,
          level: true,
          notes: true,
          specialty: {
            select: { id: true, name: true, slug: true, color: true },
          },
        },
      }),
    );
  }

  removeMemberSpecialty(
    organizationId: string,
    userId: string,
    specialtyId: string,
  ) {
    return this.rls.run((transaction) =>
      transaction.memberSpecialty.updateMany({
        where: { organizationId, userId, specialtyId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Certificações                                                     */
  /* ---------------------------------------------------------------- */

  listCertifications(
    organizationId: string,
    query: { userId?: string; expiresBefore?: Date },
  ) {
    return this.rls.run((transaction) =>
      transaction.memberCertification.findMany({
        where: {
          organizationId,
          userId: query.userId,
          deletedAt: null,
          ...(query.expiresBefore
            ? { expiresAt: { not: null, lte: query.expiresBefore } }
            : {}),
        },
        orderBy: [{ expiresAt: 'asc' }, { name: 'asc' }],
      }),
    );
  }

  findCertification(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.memberCertification.findFirst({
        where: { id, organizationId, deletedAt: null },
      }),
    );
  }

  createCertification(data: Prisma.MemberCertificationUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.memberCertification.create({ data }),
    );
  }

  updateCertification(id: string, data: Prisma.MemberCertificationUpdateInput) {
    return this.rls.run((transaction) =>
      transaction.memberCertification.update({ where: { id }, data }),
    );
  }

  softDeleteCertification(id: string): Promise<void> {
    return this.rls
      .run((transaction) =>
        transaction.memberCertification.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      )
      .then(() => undefined);
  }

  /* ---------------------------------------------------------------- */
  /* Equipes                                                           */
  /* ---------------------------------------------------------------- */

  listTeams(organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.team.findMany({
        where: { organizationId, deletedAt: null },
        select: teamView,
        orderBy: { name: 'asc' },
      }),
    );
  }

  findTeam(id: string, organizationId: string) {
    return this.rls.run((transaction) =>
      transaction.team.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: teamView,
      }),
    );
  }

  createTeam(data: Prisma.TeamUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.team.create({ data, select: teamView }),
    );
  }

  updateTeam(id: string, data: Prisma.TeamUpdateInput) {
    return this.rls.run((transaction) =>
      transaction.team.update({ where: { id }, data, select: teamView }),
    );
  }

  softDeleteTeam(id: string): Promise<void> {
    return this.rls
      .run((transaction) =>
        transaction.team.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      )
      .then(() => undefined);
  }

  upsertTeamMembership(input: {
    organizationId: string;
    teamId: string;
    userId: string;
    role?: string;
  }) {
    return this.rls.run((transaction) =>
      transaction.teamMembership.upsert({
        where: {
          teamId_userId: { teamId: input.teamId, userId: input.userId },
        },
        create: input,
        update: { role: input.role, deletedAt: null },
      }),
    );
  }

  removeTeamMembership(teamId: string, userId: string) {
    return this.rls.run((transaction) =>
      transaction.teamMembership.updateMany({
        where: { teamId, userId, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Geolocalização                                                    */
  /* ---------------------------------------------------------------- */

  createLocation(data: Prisma.MemberLocationUncheckedCreateInput) {
    return this.rls.run((transaction) =>
      transaction.memberLocation.create({ data }),
    );
  }

  /**
   * Última posição de cada pessoa dentro da janela.
   *
   * `distinct` sobre `userId` com ordenação por `recordedAt desc` devolve a
   * mais recente de cada um numa consulta só — sem trazer o histórico inteiro
   * para descartá-lo no servidor de aplicação.
   */
  latestLocations(organizationId: string, since: Date) {
    return this.rls.run((transaction) =>
      transaction.memberLocation.findMany({
        where: { organizationId, recordedAt: { gte: since } },
        distinct: ['userId'],
        orderBy: { recordedAt: 'desc' },
        select: {
          userId: true,
          latitude: true,
          longitude: true,
          accuracy: true,
          source: true,
          recordedAt: true,
          user: { select: { displayName: true } },
        },
      }),
    );
  }
}
