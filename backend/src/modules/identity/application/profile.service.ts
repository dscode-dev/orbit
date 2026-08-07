import { Inject, Injectable } from '@nestjs/common';
import type { IHashProvider } from '../../../contracts';
import {
  EntityNotFoundException,
  ValidationException,
} from '../../../exceptions';
import { HASH_PROVIDER } from '../../../providers';
import type { UpdateProfileDto } from '../presentation/dto/identity.dto';
import { IdentityRepository } from '../infrastructure/identity.repository';

@Injectable()
export class ProfileService {
  constructor(
    private readonly repository: IdentityRepository,
    @Inject(HASH_PROVIDER) private readonly hashes: IHashProvider,
  ) {}

  async get(userId: string) {
    const user = await this.repository.findById(userId);
    if (!user || user.deletedAt) throw new EntityNotFoundException('User');
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      timezone: user.timezone,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      mfaEnabled: user.mfaFactors.length > 0,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async update(userId: string, input: UpdateProfileDto) {
    await this.get(userId);
    return this.repository.updateProfile(userId, input);
  }

  /**
   * Troca a própria senha.
   *
   * Exige a senha atual — sem isso, uma sessão sequestrada trocaria a senha e
   * expulsaria o dono da conta. É a diferença entre este fluxo e o de
   * recuperação por e-mail, que existe justamente para quem **não** tem a
   * senha atual e prova identidade por outro canal.
   *
   * A verificação é `verify` do provedor de hash; nenhuma comparação de texto
   * acontece aqui.
   */
  async changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
    keepSessionId?: string,
  ): Promise<void> {
    const credential = await this.repository.findCredential(userId);
    if (!credential) throw new EntityNotFoundException('Credential');

    const matches = await this.hashes.verify(
      credential.passwordHash,
      input.currentPassword,
    );
    if (!matches) {
      throw new ValidationException('Current password does not match');
    }

    if (input.currentPassword === input.newPassword) {
      throw new ValidationException(
        'The new password must be different from the current one',
      );
    }

    await this.repository.changePassword(
      userId,
      await this.hashes.hash(input.newPassword),
      keepSessionId,
    );
  }
}
