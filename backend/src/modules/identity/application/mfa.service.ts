import { Inject, Injectable } from '@nestjs/common';
import { CRYPTO_PROVIDER, HASH_PROVIDER } from '../../../providers';
import type { ICryptoProvider, IHashProvider } from '../../../contracts';
import {
  UnauthorizedException,
  ValidationException,
} from '../../../exceptions';
import { IdentityRepository } from '../infrastructure/identity.repository';
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotp,
} from '../../../utils/totp';

@Injectable()
export class MfaService {
  constructor(
    private readonly repository: IdentityRepository,
    @Inject(CRYPTO_PROVIDER) private readonly crypto: ICryptoProvider,
    @Inject(HASH_PROVIDER) private readonly hashes: IHashProvider,
  ) {}

  async beginEnrollment(userId: string, email: string) {
    const secret = generateTotpSecret();
    const factor = await this.repository.createMfaFactor(
      userId,
      this.crypto.encrypt(secret),
    );
    return {
      factorId: factor.id,
      secret,
      uri: generateTotpUri('Orbit', email, secret),
    };
  }

  async enable(userId: string, factorId: string, code: string) {
    const factor = await this.repository.findMfaFactor(factorId, userId);
    if (!factor || factor.verifiedAt) {
      throw new ValidationException('Invalid MFA enrollment');
    }
    if (!verifyTotp(this.crypto.decrypt(factor.secret), code)) {
      throw new ValidationException('Invalid MFA code');
    }
    const recoveryCodes = Array.from({ length: 8 }, () =>
      this.crypto.randomBytes(8).toString('hex'),
    );
    const recoveryHashes = await Promise.all(
      recoveryCodes.map((recoveryCode) => this.hashes.hash(recoveryCode)),
    );
    await this.repository.enableMfaFactor(factor.id, recoveryHashes);
    return { recoveryCodes };
  }

  async verifyFactor(
    factor: { id: string; secret: string; recoveryCodes: string[] },
    code: string | undefined,
  ): Promise<void> {
    if (!code) throw new UnauthorizedException('MFA code is required');
    if (verifyTotp(this.crypto.decrypt(factor.secret), code)) {
      await this.repository.touchMfaFactor(factor.id);
      return;
    }
    const recoveryMatches = await Promise.all(
      factor.recoveryCodes.map((hash) => this.hashes.verify(hash, code)),
    );
    const matchedIndex = recoveryMatches.findIndex(Boolean);
    if (matchedIndex < 0) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.repository.consumeMfaRecoveryCode(
      factor.id,
      factor.recoveryCodes.filter((_, index) => index !== matchedIndex),
    );
  }

  disable(userId: string): Promise<void> {
    return this.repository.disableMfa(userId);
  }
}
