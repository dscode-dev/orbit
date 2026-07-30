import { Inject, Injectable } from '@nestjs/common';
import type { IHashProvider } from '../../../contracts';
import { HASH_PROVIDER } from '../../../providers';
import { ConflictException, ValidationException } from '../../../exceptions';
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
