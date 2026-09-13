import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, RlsTransaction } from '../../../database';
import type { PrismaTransactionClient } from '../../../database/prisma.types';

/**
 * Escrita de pessoas da organização.
 *
 * Separado do `OrganizationRepository` porque o que acontece aqui atravessa
 * dois agregados — `User`/`Credential` são de identidade, `*Membership` é da
 * organização — e precisa acontecer numa transação só: um usuário criado sem
 * vínculo ficaria órfão, capaz de autenticar e incapaz de ver qualquer coisa.
 */
@Injectable()
export class TeamRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rls: RlsTransaction,
  ) {}

  /**
   * Cria a pessoa e os dois vínculos, cobrando a vaga dentro da transação.
   *
   * `assertQuota` é entregue pelo chamador e roda **aqui dentro**, com o
   * contexto de inquilino já definido: contar assentos fora desta transação
   * abriria a janela em que duas criações simultâneas passam pelo mesmo teto.
   */
  createMember(
    input: {
      organizationId: string;
      businessUnitId: string;
      roleId: string;
      email: string;
      normalizedEmail: string;
      firstName: string;
      lastName: string;
      passwordHash: string;
    },
    assertQuota: (transaction: PrismaTransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await this.setLocal(
        transaction,
        'app.organization_id',
        input.organizationId,
      );
      await this.setLocal(
        transaction,
        'app.business_unit_ids',
        input.businessUnitId,
      );

      const existente = await transaction.user.findUnique({
        where: { normalizedEmail: input.normalizedEmail },
        select: { id: true },
      });
      if (existente) return { conflict: 'EMAIL_TAKEN' as const };

      await assertQuota(transaction);

      const user = await transaction.user.create({
        data: {
          email: input.email,
          normalizedEmail: input.normalizedEmail,
          firstName: input.firstName,
          lastName: input.lastName,
          displayName: `${input.firstName} ${input.lastName}`.trim(),
          status: 'ACTIVE',
          /**
           * Verificado na criação: quem cadastra é o dono da organização, que
           * já conhece a pessoa. Exigir confirmação por e-mail travaria o
           * técnico sem e-mail — o caso que motivou a senha temporária.
           */
          emailVerifiedAt: new Date(),
          credential: {
            create: {
              passwordHash: input.passwordHash,
              /** O ponto do fluxo: a senha do owner não sobrevive ao 1º acesso. */
              mustChangePassword: true,
            },
          },
        },
        select: { id: true },
      });

      await transaction.organizationMembership.create({
        data: {
          organizationId: input.organizationId,
          userId: user.id,
          roleId: input.roleId,
        },
      });
      await transaction.businessUnitMembership.create({
        data: {
          organizationId: input.organizationId,
          businessUnitId: input.businessUnitId,
          userId: user.id,
          roleId: input.roleId,
        },
      });

      return { userId: user.id };
    });
  }

  /** O membro, com o vínculo e o papel — para responder e para autorizar. */
  findMember(organizationId: string, userId: string) {
    return this.rls.run((transaction) =>
      transaction.organizationMembership.findFirst({
        where: { organizationId, userId, deletedAt: null },
        select: {
          id: true,
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

  /**
   * Desligamento: o vínculo sai, a pessoa fica.
   *
   * `User` não é apagado de propósito. Ele assina laudo, executa atendimento e
   * aparece no histórico; removê-lo deixaria documento emitido sem autor. O que
   * se desfaz é o vínculo — e é ele que ocupa a vaga do plano.
   */
  removeMember(organizationId: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.setLocal(transaction, 'app.organization_id', organizationId);
      const agora = new Date();
      await transaction.organizationMembership.updateMany({
        where: { organizationId, userId, deletedAt: null },
        data: { status: 'INACTIVE', deletedAt: agora },
      });
      await transaction.businessUnitMembership.updateMany({
        where: { organizationId, userId, deletedAt: null },
        data: { status: 'INACTIVE', deletedAt: agora },
      });
      /**
       * As sessões abertas morrem junto.
       *
       * Sem isto, o desligado continuaria trabalhando com o token que já tinha
       * na mão até ele expirar — e o motivo de desligar alguém costuma ser
       * exatamente não querer isso.
       */
      await transaction.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: agora },
      });
    });
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
