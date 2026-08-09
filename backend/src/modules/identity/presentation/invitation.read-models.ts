import { Injectable } from '@nestjs/common';

/**
 * Read Model de convite.
 *
 * ## O token nunca sai daqui
 *
 * `IdentityInvitation` guarda `tokenHash`, e o token em claro só existe no
 * instante da criação, para ser entregue por e-mail. **Nenhum dos dois é
 * publicado**: expor o hash permitiria ataque offline, e expor o token daria a
 * qualquer gestor a capacidade de aceitar o convite no lugar da pessoa.
 *
 * Este mapeamento existe justamente para tornar essa omissão explícita — um
 * `select` esquecido no repositório não vaza para a resposta.
 */
export interface InvitationReadModel {
  id: string;
  email: string;
  status: string;
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

interface InvitationSource {
  id: string;
  email: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  role: { id: string; key: string; name: string };
  businessUnit: {
    id: string;
    legalName: string;
    tradeName: string | null;
  } | null;
  invitedBy: { id: string; displayName: string } | null;
}

@Injectable()
export class InvitationReadModels {
  item(source: InvitationSource): InvitationReadModel {
    return {
      id: source.id,
      email: source.email,
      status: source.status,
      expiresAt: source.expiresAt.toISOString(),
      acceptedAt: source.acceptedAt?.toISOString() ?? null,
      createdAt: source.createdAt.toISOString(),
      role: source.role,
      businessUnit: source.businessUnit,
      invitedBy: source.invitedBy,
    };
  }
}
