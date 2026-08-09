import { Injectable } from '@nestjs/common';
import {
  ConflictException,
  EntityNotFoundException,
  ValidationException,
} from '../../exceptions';
import { SlugHelper } from '../../helpers';
import type {
  AddTeamMemberDto,
  AssignSpecialtyDto,
  CertificationQueryDto,
  CreateCertificationDto,
  CreateSpecialtyDto,
  CreateTeamDto,
  UpdateCertificationDto,
  UpdateSpecialtyDto,
  UpdateTeamDto,
} from './workforce.dto';
import { WorkforceRepository } from './workforce.repository';

const DAY_MS = 24 * 60 * 60_000;

/**
 * Regras do domínio de equipe.
 *
 * O que é decidido **aqui**, e não no cliente: unicidade de slug, dependências
 * antes de remover, e — o mais importante — o vencimento de uma certificação,
 * que é comparado com o relógio do servidor no mapper.
 */
@Injectable()
export class WorkforceService {
  constructor(private readonly repository: WorkforceRepository) {}

  /* ---------------------------------------------------------------- */
  /* Especialidades                                                    */
  /* ---------------------------------------------------------------- */

  listSpecialties(organizationId: string) {
    return this.repository.listSpecialties(organizationId);
  }

  async createSpecialty(organizationId: string, input: CreateSpecialtyDto) {
    try {
      return await this.repository.createSpecialty({
        organizationId,
        name: input.name,
        slug: SlugHelper.create(input.name),
        description: input.description,
        color: input.color,
      });
    } catch (error) {
      this.rethrowConflict(error, 'A specialty with this name already exists');
    }
  }

  async updateSpecialty(
    id: string,
    organizationId: string,
    input: UpdateSpecialtyDto,
  ) {
    await this.requireSpecialty(id, organizationId);
    try {
      return await this.repository.updateSpecialty(id, {
        name: input.name,
        description: input.description,
        color: input.color,
        ...(input.name ? { slug: SlugHelper.create(input.name) } : {}),
      });
    } catch (error) {
      this.rethrowConflict(error, 'A specialty with this name already exists');
    }
  }

  /**
   * Remove uma especialidade.
   *
   * Recusa enquanto houver pessoa vinculada: apagar a especialidade apagaria a
   * informação de que aquelas pessoas a possuem, sem que ninguém peça isso.
   */
  async removeSpecialty(id: string, organizationId: string): Promise<void> {
    await this.requireSpecialty(id, organizationId);
    const assignments = await this.repository.specialtyAssignments(id);
    if (assignments > 0) {
      throw new ConflictException(
        'Specialty is still assigned to team members',
      );
    }
    await this.repository.softDeleteSpecialty(id);
  }

  listMemberSpecialties(organizationId: string, userId?: string) {
    return this.repository.listMemberSpecialties(organizationId, userId);
  }

  async assignSpecialty(
    organizationId: string,
    userId: string,
    input: AssignSpecialtyDto,
  ) {
    await this.requireSpecialty(input.specialtyId, organizationId);
    return this.repository.upsertMemberSpecialty({
      organizationId,
      userId,
      specialtyId: input.specialtyId,
      level: input.level ?? 'PLENO',
      notes: input.notes,
    });
  }

  async unassignSpecialty(
    organizationId: string,
    userId: string,
    specialtyId: string,
  ): Promise<void> {
    const { count } = await this.repository.removeMemberSpecialty(
      organizationId,
      userId,
      specialtyId,
    );
    if (count === 0) {
      throw new EntityNotFoundException('MemberSpecialty', specialtyId);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Certificações                                                     */
  /* ---------------------------------------------------------------- */

  listCertifications(organizationId: string, query: CertificationQueryDto) {
    return this.repository.listCertifications(organizationId, {
      userId: query.userId,
      expiresBefore:
        query.expiringWithinDays === undefined
          ? undefined
          : new Date(Date.now() + query.expiringWithinDays * DAY_MS),
    });
  }

  createCertification(
    organizationId: string,
    userId: string,
    input: CreateCertificationDto,
  ) {
    this.assertPeriod(input.issuedAt, input.expiresAt);
    return this.repository.createCertification({
      organizationId,
      userId,
      name: input.name,
      issuer: input.issuer,
      credentialId: input.credentialId,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      fileId: input.fileId,
      notes: input.notes,
    });
  }

  async updateCertification(
    id: string,
    organizationId: string,
    input: UpdateCertificationDto,
  ) {
    const current = await this.repository.findCertification(id, organizationId);
    if (!current) throw new EntityNotFoundException('Certification', id);

    this.assertPeriod(
      input.issuedAt ?? current.issuedAt ?? undefined,
      input.expiresAt ?? current.expiresAt ?? undefined,
    );

    return this.repository.updateCertification(id, {
      name: input.name,
      issuer: input.issuer,
      credentialId: input.credentialId,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      notes: input.notes,
    });
  }

  async removeCertification(id: string, organizationId: string): Promise<void> {
    const current = await this.repository.findCertification(id, organizationId);
    if (!current) throw new EntityNotFoundException('Certification', id);
    await this.repository.softDeleteCertification(id);
  }

  /* ---------------------------------------------------------------- */
  /* Equipes                                                           */
  /* ---------------------------------------------------------------- */

  listTeams(organizationId: string) {
    return this.repository.listTeams(organizationId);
  }

  async getTeam(id: string, organizationId: string) {
    const team = await this.repository.findTeam(id, organizationId);
    if (!team) throw new EntityNotFoundException('Team', id);
    return team;
  }

  async createTeam(organizationId: string, input: CreateTeamDto) {
    try {
      return await this.repository.createTeam({
        organizationId,
        name: input.name,
        slug: SlugHelper.create(input.name),
        description: input.description,
        color: input.color,
        businessUnitId: input.businessUnitId,
        leaderUserId: input.leaderUserId,
      });
    } catch (error) {
      this.rethrowConflict(error, 'A team with this name already exists');
    }
  }

  async updateTeam(id: string, organizationId: string, input: UpdateTeamDto) {
    await this.getTeam(id, organizationId);
    try {
      return await this.repository.updateTeam(id, {
        name: input.name,
        description: input.description,
        color: input.color,
        status: input.status,
        ...(input.name ? { slug: SlugHelper.create(input.name) } : {}),
        ...(input.businessUnitId
          ? { businessUnit: { connect: { id: input.businessUnitId } } }
          : {}),
        ...(input.leaderUserId
          ? { leader: { connect: { id: input.leaderUserId } } }
          : {}),
      });
    } catch (error) {
      this.rethrowConflict(error, 'A team with this name already exists');
    }
  }

  async removeTeam(id: string, organizationId: string): Promise<void> {
    await this.getTeam(id, organizationId);
    await this.repository.softDeleteTeam(id);
  }

  async addTeamMember(
    teamId: string,
    organizationId: string,
    input: AddTeamMemberDto,
  ) {
    await this.getTeam(teamId, organizationId);
    await this.repository.upsertTeamMembership({
      organizationId,
      teamId,
      userId: input.userId,
      role: input.role,
    });
    return this.getTeam(teamId, organizationId);
  }

  async removeTeamMember(
    teamId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.getTeam(teamId, organizationId);
    const { count } = await this.repository.removeTeamMembership(
      teamId,
      userId,
    );
    if (count === 0)
      throw new EntityNotFoundException('TeamMembership', userId);
    return this.getTeam(teamId, organizationId);
  }

  /* ---------------------------------------------------------------- */
  /* Geolocalização                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * Registra a posição de quem está autenticado.
   *
   * `userId` vem da identidade, nunca do corpo: ninguém publica a posição de
   * outro. `recordedAt` no futuro é recusado — um dispositivo com relógio
   * adiantado envenenaria a ordenação de "última posição".
   */
  reportLocation(
    organizationId: string,
    userId: string,
    input: {
      latitude: number;
      longitude: number;
      accuracy?: number;
      source?: string;
      recordedAt?: Date;
    },
  ) {
    const recordedAt = input.recordedAt ?? new Date();
    if (recordedAt.getTime() > Date.now() + 60_000) {
      throw new ValidationException('recordedAt cannot be in the future');
    }

    return this.repository.createLocation({
      organizationId,
      userId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      source: input.source ?? 'MOBILE',
      recordedAt,
    });
  }

  latestLocations(organizationId: string, withinMinutes: number) {
    return this.repository.latestLocations(
      organizationId,
      new Date(Date.now() - withinMinutes * 60_000),
    );
  }

  /* ---------------------------------------------------------------- */

  private async requireSpecialty(id: string, organizationId: string) {
    const specialty = await this.repository.findSpecialty(id, organizationId);
    if (!specialty) throw new EntityNotFoundException('Specialty', id);
    return specialty;
  }

  /** Uma certificação não pode vencer antes de ser emitida. */
  private assertPeriod(issuedAt?: Date, expiresAt?: Date): void {
    if (issuedAt && expiresAt && expiresAt.getTime() < issuedAt.getTime()) {
      throw new ValidationException('expiresAt must be after issuedAt');
    }
  }

  private rethrowConflict(error: unknown, message: string): never {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
