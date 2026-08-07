/**
 * Serviços do Workforce Management.
 *
 * Duas origens, um módulo: membros e papéis vêm de `organizations/current`,
 * convites vêm de `identity/invitations`. É a divisão do backend, e o service
 * a preserva — não há um recurso "equipe" no servidor, e inventar um caminho
 * único aqui esconderia de onde cada coisa vem.
 *
 * As **keys** de membro e papel são as de `organizations`: o Organization
 * Workspace já lê membros, e as duas telas compartilham a mesma consulta em
 * vez de manterem caches paralelos.
 */
import { apiClient } from "@/api/client";
import { queryKeys, type QueryKey } from "@/api/query-keys";
import { organizationService } from "@/services/organization.service";
import type { QueryParams, RequestOptions } from "@/types/api";
import type { PaginatedResult } from "@/types/api";
import type {
  AddTeamMemberInput,
  AssignSpecialtyInput,
  CertificationQuery,
  CreateCertificationInput,
  CreateInvitationInput,
  CreateRoleInput,
  CreateSpecialtyInput,
  CreateTeamInput,
  InvitationQuery,
  MemberCertification,
  MemberLocation,
  MemberQuery,
  MemberSpecialty,
  ReportLocationInput,
  Specialty,
  Team,
  TeamInvitation,
  TeamMember,
  TeamRole,
  UpdateCertificationInput,
  UpdateMemberInput,
  UpdateRoleInput,
  UpdateSpecialtyInput,
  UpdateTeamInput,
} from "@/types/workforce";

const INVITATIONS = "identity-invitations";
const WORKFORCE = "workforce";

const INVITATIONS_PATH = "/identity/invitations";
const ORG_PATH = "/organizations/current";
const WORKFORCE_PATH = "/workforce";

const invitation = (id: string): string =>
  `${INVITATIONS_PATH}/${encodeURIComponent(id)}`;

const path = (base: string, ...segments: string[]): string =>
  [base, ...segments.map(encodeURIComponent)].join("/");

export const workforceService = {
  /* ---------------------------------------------------------------- */
  /* Membros                                                           */
  /* ---------------------------------------------------------------- */

  members: (
    query?: MemberQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<TeamMember>> =>
    apiClient.get<PaginatedResult<TeamMember>>(`${ORG_PATH}/members`, {
      ...options,
      query: query as QueryParams | undefined,
    }),

  /** Papel e situação. Perfil é de `identity/me`, não daqui. */
  updateMember: (
    userId: string,
    input: UpdateMemberInput,
  ): Promise<TeamMember> =>
    apiClient.patch<TeamMember>(path(`${ORG_PATH}/members`, userId), input),

  /* ---------------------------------------------------------------- */
  /* Papéis                                                            */
  /* ---------------------------------------------------------------- */

  roles: (options?: RequestOptions): Promise<TeamRole[]> =>
    apiClient.get<TeamRole[]>(`${ORG_PATH}/roles`, options),

  createRole: (input: CreateRoleInput): Promise<TeamRole> =>
    apiClient.post<TeamRole>(`${ORG_PATH}/roles`, input),

  updateRole: (id: string, input: UpdateRoleInput): Promise<TeamRole> =>
    apiClient.patch<TeamRole>(path(`${ORG_PATH}/roles`, id), input),

  removeRole: (id: string): Promise<void> =>
    apiClient.delete<void>(path(`${ORG_PATH}/roles`, id)),

  /* ---------------------------------------------------------------- */
  /* Convites                                                          */
  /* ---------------------------------------------------------------- */

  invitations: (
    query?: InvitationQuery,
    options?: RequestOptions,
  ): Promise<PaginatedResult<TeamInvitation>> =>
    apiClient.get<PaginatedResult<TeamInvitation>>(INVITATIONS_PATH, {
      ...options,
      query: query as QueryParams | undefined,
    }),

  invite: (
    input: CreateInvitationInput,
  ): Promise<{ id: string; expiresAt: string }> =>
    apiClient.post<{ id: string; expiresAt: string }>(INVITATIONS_PATH, input),

  /** Reenvia: gera token novo, e o anterior deixa de valer. */
  resendInvitation: (
    id: string,
  ): Promise<{ id: string; expiresAt: string }> =>
    apiClient.post<{ id: string; expiresAt: string }>(
      `${invitation(id)}/resend`,
      {},
    ),

  /** Cancela: o registro permanece como `REVOKED`, para auditoria. */
  revokeInvitation: (id: string): Promise<void> =>
    apiClient.delete<void>(invitation(id)),

  /* ---------------------------------------------------------------- */
  /* Especialidades                                                    */
  /* ---------------------------------------------------------------- */

  specialties: (options?: RequestOptions): Promise<Specialty[]> =>
    apiClient.get<Specialty[]>(`${WORKFORCE_PATH}/specialties`, options),

  createSpecialty: (input: CreateSpecialtyInput): Promise<Specialty> =>
    apiClient.post<Specialty>(`${WORKFORCE_PATH}/specialties`, input),

  updateSpecialty: (
    id: string,
    input: UpdateSpecialtyInput,
  ): Promise<Specialty> =>
    apiClient.patch<Specialty>(
      path(`${WORKFORCE_PATH}/specialties`, id),
      input,
    ),

  removeSpecialty: (id: string): Promise<void> =>
    apiClient.delete<void>(path(`${WORKFORCE_PATH}/specialties`, id)),

  memberSpecialties: (
    userId?: string,
    options?: RequestOptions,
  ): Promise<MemberSpecialty[]> =>
    apiClient.get<MemberSpecialty[]>(`${WORKFORCE_PATH}/members/specialties`, {
      ...options,
      query: userId ? { userId } : undefined,
    }),

  assignSpecialty: (
    userId: string,
    input: AssignSpecialtyInput,
  ): Promise<MemberSpecialty> =>
    apiClient.post<MemberSpecialty>(
      `${path(`${WORKFORCE_PATH}/members`, userId)}/specialties`,
      input,
    ),

  unassignSpecialty: (userId: string, specialtyId: string): Promise<void> =>
    apiClient.delete<void>(
      `${path(`${WORKFORCE_PATH}/members`, userId)}/specialties/${encodeURIComponent(specialtyId)}`,
    ),

  /* ---------------------------------------------------------------- */
  /* Certificações                                                     */
  /* ---------------------------------------------------------------- */

  certifications: (
    query?: CertificationQuery,
    options?: RequestOptions,
  ): Promise<MemberCertification[]> =>
    apiClient.get<MemberCertification[]>(`${WORKFORCE_PATH}/certifications`, {
      ...options,
      query: query as QueryParams | undefined,
    }),

  createCertification: (
    userId: string,
    input: CreateCertificationInput,
  ): Promise<MemberCertification> =>
    apiClient.post<MemberCertification>(
      `${path(`${WORKFORCE_PATH}/members`, userId)}/certifications`,
      input,
    ),

  updateCertification: (
    id: string,
    input: UpdateCertificationInput,
  ): Promise<MemberCertification> =>
    apiClient.patch<MemberCertification>(
      path(`${WORKFORCE_PATH}/certifications`, id),
      input,
    ),

  removeCertification: (id: string): Promise<void> =>
    apiClient.delete<void>(path(`${WORKFORCE_PATH}/certifications`, id)),

  /* ---------------------------------------------------------------- */
  /* Equipes                                                           */
  /* ---------------------------------------------------------------- */

  teams: (options?: RequestOptions): Promise<Team[]> =>
    apiClient.get<Team[]>(`${WORKFORCE_PATH}/teams`, options),

  createTeam: (input: CreateTeamInput): Promise<Team> =>
    apiClient.post<Team>(`${WORKFORCE_PATH}/teams`, input),

  updateTeam: (id: string, input: UpdateTeamInput): Promise<Team> =>
    apiClient.patch<Team>(path(`${WORKFORCE_PATH}/teams`, id), input),

  removeTeam: (id: string): Promise<void> =>
    apiClient.delete<void>(path(`${WORKFORCE_PATH}/teams`, id)),

  addTeamMember: (teamId: string, input: AddTeamMemberInput): Promise<Team> =>
    apiClient.post<Team>(
      `${path(`${WORKFORCE_PATH}/teams`, teamId)}/members`,
      input,
    ),

  removeTeamMember: (teamId: string, userId: string): Promise<Team> =>
    apiClient.delete<Team>(
      `${path(`${WORKFORCE_PATH}/teams`, teamId)}/members/${encodeURIComponent(userId)}`,
    ),

  /* ---------------------------------------------------------------- */
  /* Geolocalização                                                    */
  /* ---------------------------------------------------------------- */

  /** Reporta a **própria** posição — o backend usa a identidade autenticada. */
  reportLocation: (input: ReportLocationInput): Promise<{ accepted: true }> =>
    apiClient.post<{ accepted: true }>(`${WORKFORCE_PATH}/me/location`, input),

  locations: (
    withinMinutes: number,
    options?: RequestOptions,
  ): Promise<MemberLocation[]> =>
    apiClient.get<MemberLocation[]>(`${WORKFORCE_PATH}/locations`, {
      ...options,
      query: { withinMinutes },
    }),

  keys: {
    /** Membros e papéis pertencem ao módulo `organizations`. */
    members: (query?: MemberQuery): QueryKey =>
      query
        ? queryKeys.list("organizations-members", query as QueryParams)
        : organizationService.keys.members(),
    roles: (): QueryKey => queryKeys.query("organizations", "roles"),

    invitationsModule: (): QueryKey => queryKeys.module(INVITATIONS),
    invitations: (query?: InvitationQuery): QueryKey =>
      queryKeys.list(INVITATIONS, query as QueryParams | undefined),

    workforceModule: (): QueryKey => queryKeys.module(WORKFORCE),
    specialties: (): QueryKey => queryKeys.query(WORKFORCE, "specialties"),
    memberSpecialties: (userId?: string): QueryKey =>
      queryKeys.query(WORKFORCE, "member-specialties", { userId }),
    certifications: (query?: CertificationQuery): QueryKey =>
      queryKeys.query(
        WORKFORCE,
        "certifications",
        query as QueryParams | undefined,
      ),
    teams: (): QueryKey => queryKeys.query(WORKFORCE, "teams"),
    locations: (withinMinutes: number): QueryKey =>
      queryKeys.query(WORKFORCE, "locations", { withinMinutes }),
  },
} as const;
