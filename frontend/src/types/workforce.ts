/**
 * Contratos do Workforce Management.
 *
 * Reúne os três contratos que descrevem a equipe — membros, convites e
 * papéis — sem redeclarar nenhum: todos vêm dos Read Models sincronizados.
 *
 * ## Não substitui autenticação
 *
 * Aqui não há login, sessão, MFA nem senha. `identity/me` e `identity/sessions`
 * continuam sendo do domínio de autenticação; este módulo é **gestão
 * operacional da equipe** — quem faz parte, com que papel, em que unidade, e o
 * que cada pessoa tem para fazer.
 */
import type {
  OrganizationMemberReadModel,
  OrganizationRoleReadModel,
} from "./contracts/modules/organizations/organization.read-models";
import type { InvitationStatus } from "./contracts";

export type { InvitationStatus };

/** Membro da organização (`GET /organizations/current/members`). */
export type TeamMember = OrganizationMemberReadModel;

/** Papel e o que ele concede (`GET /organizations/current/roles`). */
export type TeamRole = OrganizationRoleReadModel;

/**
 * Convite (`GET /identity/invitations`).
 *
 * Espelhado do `InvitationReadModel` do backend. **Não há token** — nem em
 * claro nem em hash: ele é entregue uma vez, por e-mail, e reexpô-lo daria a
 * qualquer gestor a capacidade de aceitar o convite no lugar da pessoa.
 */
export interface TeamInvitation {
  id: string;
  email: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  role: { id: string; key: string; name: string };
  businessUnit: {
    id: string;
    legalName: string;
    tradeName: string | null;
  } | null;
  invitedBy: { id: string; displayName: string } | null;
}

/** `GET /identity/invitations` (`InvitationQueryDto`). */
export interface InvitationQuery {
  status?: InvitationStatus;
}

/** `POST /identity/invitations` (`CreateInvitationDto`). */
export interface CreateInvitationInput {
  email: string;
  roleId: string;
  businessUnitId?: string;
}

/**
 * O que o contrato de equipe **não** tem, e que a tela por isso não inventa:
 *
 * - **edição de membro** — não há `PATCH /organizations/current/members/:id`;
 *   nome, e-mail e avatar são do domínio de perfil, que cada pessoa administra
 *   em `identity/me`;
 * - **ativar/desativar membro** — a coluna `OrganizationMembership.status`
 *   existe e é publicada, mas nenhuma rota a escreve;
 * - **trocar o papel de alguém** — `roleId` só é informado no convite;
 * - **edição de papéis** — `Role.permissions` é semeado; não há rota de
 *   escrita, e `isSystem` marca os que nem deveriam ter;
 * - **produtividade** — o Analytics publica `technicians.active` e
 *   `technicians.assignment_coverage`, e nada por pessoa;
 * - **disponibilidade em tempo real** — `scheduling/availability` responde por
 *   janela consultada, não por presença;
 * - **IA por pessoa** — `AiExecutionQueryDto` não aceita `userId`.
 */
export const WORKFORCE_CONTRACT_GAPS = [
  "memberUpdate",
  "memberStatusWrite",
  "roleAssignment",
  "roleEditing",
  "perUserProductivity",
  "realtimeAvailability",
  "intelligence",
] as const;
