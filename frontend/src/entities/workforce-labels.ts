/**
 * Rótulos dos literais de equipe.
 *
 * `InvitationStatus` é lista fechada nos contratos sincronizados; o mapa cobre
 * exatamente esses valores e qualquer outro é exibido cru.
 *
 * O status de **membro** (`OrganizationMembership.status`) é `VarChar` livre no
 * schema, sem literal — por isso o mapa cobre os valores observados e deixa os
 * demais passarem.
 */
import type { InvitationStatus } from "@/types/contracts";

export const INVITATION_STATUS_LABELS: Readonly<
  Record<InvitationStatus | string, string>
> = {
  PENDING: "Aguardando",
  ACCEPTED: "Aceito",
  EXPIRED: "Expirado",
  REVOKED: "Cancelado",
};

export const MEMBER_STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  SUSPENDED: "Suspenso",
};
