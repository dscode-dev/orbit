import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../exceptions';
import { SlugHelper } from '../../helpers';
import type {
  CreateOrganizationDto,
  UpdateOrganizationDto,
} from './dto/organization.dto';
import { OrganizationRepository } from './organization.repository';

@Injectable()
export class OrganizationService {
  constructor(private readonly repository: OrganizationRepository) {}

  async create(ownerUserId: string, input: CreateOrganizationDto) {
    const slug = SlugHelper.create(input.displayName);
    const businessUnitSlug = SlugHelper.create(
      input.primaryBusinessUnit.tradeName ??
        input.primaryBusinessUnit.legalName,
    );
    if (!slug || !businessUnitSlug) {
      throw new ValidationException('Unable to generate a valid slug');
    }
    try {
      const organization = await this.repository.create(
        ownerUserId,
        input,
        slug,
        businessUnitSlug,
      );
      if (!organization) throw new ValidationException('Invalid plan');
      return organization;
    } catch (error) {
      if (error instanceof ValidationException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Organization or primary business unit already exists',
        );
      }
      throw error;
    }
  }

  async getCurrent(organizationId: string) {
    const organization = await this.repository.findCurrent(organizationId);
    if (!organization) throw new EntityNotFoundException('Organization');
    return organization;
  }

  /** Membros da organização, com o dono identificado pelo próprio registro. */
  async listMembers(
    organizationId: string,
    pagination?: { page: number; limit: number },
  ) {
    const organization = await this.getCurrent(organizationId);
    const window = pagination
      ? {
          skip: (pagination.page - 1) * pagination.limit,
          take: pagination.limit,
        }
      : undefined;

    const [members, unitMemberships, total] = await Promise.all([
      this.repository.listMembers(organizationId, window),
      this.repository.listBusinessUnitMemberships(organizationId),
      this.repository.countMembers(organizationId),
    ]);
    return {
      members,
      unitMemberships,
      total,
      ownerUserId: organization.ownerUserId,
    };
  }

  /**
   * Altera papel e situação de um membro.
   *
   * ## O dono não muda
   *
   * `ownerUserId` é atributo da organização. Rebaixar o dono deixaria a conta
   * sem ninguém capaz de administrá-la — e transferir a propriedade é outra
   * operação, com outras consequências, que este endpoint não faz.
   */
  async updateMember(
    organizationId: string,
    userId: string,
    input: { roleId?: string; status?: string },
  ) {
    const organization = await this.getCurrent(organizationId);

    if (userId === organization.ownerUserId) {
      throw new ValidationException(
        'The organization owner cannot be modified here',
      );
    }

    const membership = await this.repository.findMembership(
      organizationId,
      userId,
    );
    if (!membership) throw new EntityNotFoundException('Member', userId);

    if (input.roleId) {
      const role = await this.repository.findRole(input.roleId, organizationId);
      if (!role) throw new ValidationException('Invalid role');
    }

    const updated = await this.repository.updateMembership(membership.id, {
      roleId: input.roleId,
      status: input.status,
    });
    return { member: updated, ownerUserId: organization.ownerUserId };
  }

  async listRoles(organizationId: string) {
    await this.getCurrent(organizationId);
    return this.repository.listRoles(organizationId);
  }

  async createRole(
    organizationId: string,
    input: { name: string; description?: string; permissions?: string[] },
  ) {
    await this.getCurrent(organizationId);
    try {
      return await this.repository.createRole({
        organizationId,
        key: this.roleKey(input.name),
        name: input.name,
        description: input.description,
        permissions: input.permissions ?? [],
        /** Papel criado pela organização nunca é de sistema. */
        isSystem: false,
      });
    } catch (error) {
      this.rethrowRoleConflict(error);
    }
  }

  async updateRole(
    id: string,
    organizationId: string,
    input: { name?: string; description?: string; permissions?: string[] },
  ) {
    const role = await this.requireRole(id, organizationId);

    /**
     * Papel de sistema não se edita.
     *
     * `isSystem` marca o que a plataforma semeou; alterar as suas permissões
     * mudaria o significado do papel para além desta organização.
     */
    if (role.isSystem) {
      throw new ValidationException('System roles cannot be modified');
    }

    try {
      return await this.repository.updateRole(id, {
        name: input.name,
        description: input.description,
        permissions: input.permissions,
        ...(input.name ? { key: this.roleKey(input.name) } : {}),
      });
    } catch (error) {
      this.rethrowRoleConflict(error);
    }
  }

  /**
   * Remove um papel.
   *
   * Recusa enquanto houver membro ou convite pendente apontando para ele —
   * caso contrário, uma pessoa ficaria sem papel e sem permissões, e um
   * convite não teria o que conceder ao ser aceito.
   */
  async removeRole(id: string, organizationId: string): Promise<void> {
    const role = await this.requireRole(id, organizationId);
    if (role.isSystem) {
      throw new ValidationException('System roles cannot be removed');
    }

    const dependencies = await this.repository.roleDependencies(id);
    if (dependencies.members > 0 || dependencies.invitations > 0) {
      throw new ConflictException(
        'Role still has members or pending invitations',
      );
    }
    await this.repository.softDeleteRole(id);
  }

  private async requireRole(id: string, organizationId: string) {
    const role = await this.repository.findRole(id, organizationId);
    if (!role) throw new EntityNotFoundException('Role', id);
    return role;
  }

  /**
   * Chave derivada do nome.
   *
   * `@@unique([organizationId, key])` exige uma chave estável; derivá-la do
   * nome mantém o padrão dos papéis semeados (`OWNER`) sem pedir ao usuário um
   * identificador técnico que ele não deveria inventar.
   */
  private roleKey(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80);
  }

  private rethrowRoleConflict(error: unknown): never {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new ConflictException('A role with this name already exists');
    }
    throw error;
  }

  async update(organizationId: string, input: UpdateOrganizationDto) {
    await this.getCurrent(organizationId);
    return this.repository.updateCurrent(organizationId, {
      displayName: input.displayName,
      primarySegment: input.primarySegment,
      settings: input.settings as Prisma.InputJsonValue | undefined,
    });
  }
}
