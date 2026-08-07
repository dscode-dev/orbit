import { Inject, Injectable } from '@nestjs/common';
import type { IHashProvider } from '../../../contracts';
import { HASH_PROVIDER } from '../../../providers';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../../exceptions';
import {
  IDENTITY_TOKEN_DELIVERY,
  IdentityTokenPurpose,
  type IIdentityTokenDelivery,
} from '../domain/identity.types';
import { IdentityRepository } from '../infrastructure/identity.repository';
import { IdentityTokenService } from './token.service';

@Injectable()
export class InvitationService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly tokens: IdentityTokenService,
    @Inject(HASH_PROVIDER) private readonly hashes: IHashProvider,
    @Inject(IDENTITY_TOKEN_DELIVERY)
    private readonly delivery: IIdentityTokenDelivery,
  ) {}

  async create(input: {
    organizationId: string;
    businessUnitId?: string;
    roleId: string;
    invitedById: string;
    email: string;
  }): Promise<{ id: string; expiresAt: Date }> {
    const token = this.tokens.generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    try {
      const invitation = await this.repository.createInvitation({
        organizationId: input.organizationId,
        businessUnitId: input.businessUnitId,
        roleId: input.roleId,
        invitedById: input.invitedById,
        email: input.email.trim(),
        normalizedEmail: input.email.trim().toLowerCase(),
        tokenHash: this.tokens.hashOpaqueToken(token),
        expiresAt,
      });
      await this.delivery.deliver(
        IdentityTokenPurpose.INVITATION,
        invitation.email,
        token,
      );
      return { id: invitation.id, expiresAt };
    } catch {
      throw new ConflictException('A pending invitation already exists');
    }
  }

  /**
   * Convites da organização.
   *
   * O **token nunca é publicado** — nem o valor, nem o hash. Ele é entregue
   * uma vez, por e-mail, no ato do convite; reexpô-lo numa listagem daria a
   * qualquer gestor a capacidade de entrar como o convidado.
   *
   * Reenviar gera um token novo, e é por isso que o antigo deixa de valer.
   */
  list(
    organizationId: string,
    query: { status?: string; search?: string; page: number; limit: number },
  ) {
    return this.repository.listInvitations(organizationId, {
      status: query.status,
      search: query.search,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  }

  /**
   * Reenvia um convite pendente.
   *
   * Gera **token novo** e prazo novo: o link anterior deixa de funcionar. É o
   * comportamento seguro — se o convite foi reenviado, foi porque o primeiro
   * não chegou ou não devia mais valer.
   */
  async resend(
    id: string,
    organizationId: string,
  ): Promise<{ id: string; expiresAt: Date }> {
    const invitation = await this.requirePending(id, organizationId);

    const token = this.tokens.generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);

    await this.repository.refreshInvitation(invitation.id, organizationId, {
      tokenHash: this.tokens.hashOpaqueToken(token),
      expiresAt,
    });
    await this.delivery.deliver(
      IdentityTokenPurpose.INVITATION,
      invitation.email,
      token,
    );
    return { id: invitation.id, expiresAt };
  }

  async revoke(id: string, organizationId: string): Promise<void> {
    await this.requirePending(id, organizationId);
    await this.repository.revokeInvitation(id, organizationId);
  }

  /**
   * Só convite pendente aceita reenvio ou cancelamento.
   *
   * Um convite aceito virou membro; um cancelado já não vale; um expirado
   * precisa de outro convite. Reabri-los seria mudar o passado.
   */
  private async requirePending(id: string, organizationId: string) {
    const invitation = await this.repository.findInvitationById(
      id,
      organizationId,
    );
    if (!invitation) throw new EntityNotFoundException('Invitation', id);
    if (invitation.status !== 'PENDING') {
      throw new ValidationException(
        `Invitation is ${invitation.status.toLowerCase()} and cannot be changed`,
      );
    }
    return invitation;
  }

  async accept(input: {
    token: string;
    firstName: string;
    lastName: string;
    password: string;
  }): Promise<void> {
    const invitation = await this.repository.findInvitation(
      this.tokens.hashOpaqueToken(input.token),
    );
    if (
      !invitation ||
      invitation.status !== 'PENDING' ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      throw new ValidationException('Invalid or expired invitation');
    }
    await this.repository.acceptInvitation(invitation.id, {
      email: invitation.email,
      normalizedEmail: invitation.normalizedEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: await this.hashes.hash(input.password),
      organizationId: invitation.organizationId,
      businessUnitId: invitation.businessUnitId,
      roleId: invitation.roleId,
    });
  }
}
