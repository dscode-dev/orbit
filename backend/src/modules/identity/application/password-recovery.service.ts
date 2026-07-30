import { Inject, Injectable } from '@nestjs/common';
import type { IHashProvider } from '../../../contracts';
import { HASH_PROVIDER } from '../../../providers';
import { ValidationException } from '../../../exceptions';
import {
  IDENTITY_TOKEN_DELIVERY,
  IdentityTokenPurpose,
  type IIdentityTokenDelivery,
} from '../domain/identity.types';
import { IdentityRepository } from '../infrastructure/identity.repository';
import { IdentityTokenService } from './token.service';

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly tokens: IdentityTokenService,
    @Inject(HASH_PROVIDER) private readonly hashes: IHashProvider,
    @Inject(IDENTITY_TOKEN_DELIVERY)
    private readonly delivery: IIdentityTokenDelivery,
  ) {}

  async request(email: string): Promise<void> {
    const user = await this.repository.findByEmail(email);
    if (!user || user.deletedAt || !user.credential) return;
    const token = this.tokens.generateOpaqueToken();
    await this.repository.createPasswordReset(
      user.id,
      this.tokens.hashOpaqueToken(token),
      new Date(Date.now() + 30 * 60_000),
    );
    await this.delivery.deliver(
      IdentityTokenPurpose.PASSWORD_RESET,
      user.email,
      token,
    );
  }

  async reset(token: string, password: string): Promise<void> {
    const reset = await this.repository.findPasswordReset(
      this.tokens.hashOpaqueToken(token),
    );
    if (!reset || reset.usedAt || reset.expiresAt.getTime() <= Date.now()) {
      throw new ValidationException('Invalid or expired reset token');
    }
    await this.repository.consumePasswordReset(
      reset.id,
      reset.userId,
      await this.hashes.hash(password),
    );
  }
}
