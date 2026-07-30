import { Injectable } from '@nestjs/common';
import { EntityNotFoundException } from '../../../exceptions';
import type { UpdateProfileDto } from '../presentation/dto/identity.dto';
import { IdentityRepository } from '../infrastructure/identity.repository';

@Injectable()
export class ProfileService {
  constructor(private readonly repository: IdentityRepository) {}

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
}
