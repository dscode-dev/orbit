/**
 * Os papéis que toda organização tem no primeiro dia.
 *
 * ## Por que isto existe
 *
 * Até aqui o registro criava **só** `OWNER`. Quem abria a conta e tentava
 * cadastrar um técnico não tinha papel nenhum para escolher, e o único caminho
 * era compor permissões à mão em `POST /organizations/current/roles` — pedir a
 * um gestor de HVAC-R que decida se `artifact_manifests.issue` pertence ao
 * ajudante dele não é uma escolha que a interface tenha o direito de oferecer.
 *
 * ## A diferença entre os dois técnicos
 *
 * O **operacional** é quem executa: ele abre o atendimento, preenche o
 * checklist, registra material e fecha. O **auxiliar** acompanha: vê o que foi
 * atribuído a ele, abre a rota, lê o documento já emitido e compartilha — e não
 * executa nem emite nada.
 *
 * Isso duplica de propósito a regra que já existe **por atendimento**
 * (`auxiliaryTechnicianIds`, PR-35): lá o mesmo técnico operacional entra como
 * auxiliar num atendimento específico. São camadas diferentes — uma diz o que a
 * pessoa é na organização, a outra o que ela é naquele serviço — e a mais
 * restritiva vence, porque as duas são checadas.
 */

/** Leitura do que o técnico precisa ver para trabalhar. */
const LEITURA_DE_CAMPO = [
  'operations.read',
  'operations.attachments.read',
  'operations.history.read',
  'customers.read',
  'contacts.read',
  'assets.read',
  'checklists.read',
  'scheduling.read',
  'inventory.read',
  'catalog.read',
  'pmoc.read',
  'rvt.read',
  'reports.read',
  'reports.documents.read',
  'artifact_executions.read',
  'artifact_manifests.read',
  'notifications.read',
] as const;

/** O que separa quem executa de quem acompanha. */
const EXECUCAO_DE_CAMPO = [
  'operations.update',
  'operations.status.update',
  'operations.attachments.create',
  'checklists.execute',
  'checklists.update',
  'inventory.manage',
  'rvt.execute',
  'rvt.document',
  'artifact_executions.create',
  'artifact_executions.execute',
  'artifact_executions.update',
  'artifact_manifests.issue',
  'artifact_rendering.render',
  'signatures.create',
  'signatures.read',
  'reports.create',
  'reports.update',
  'reports.status.update',
  'reports.finalize',
  'reports.render',
] as const;

/**
 * Onde um papel pode entrar.
 *
 * `API` existe para integração e não é oferecido na tela de equipe — quem
 * precisa dela declara explicitamente.
 */
export const ROLE_SURFACES = ['WEB', 'MOBILE', 'API'] as const;
export type RoleSurface = (typeof ROLE_SURFACES)[number];

/** O padrão de um papel novo: administra pela web e acompanha pelo app. */
export const DEFAULT_ROLE_SURFACES: readonly RoleSurface[] = ['WEB', 'MOBILE'];

/** Os dois papéis de campo: o trabalho deles é no aplicativo. */
export const FIELD_ONLY_SURFACES: readonly RoleSurface[] = ['MOBILE'];

export interface TeamRoleSeed {
  key: string;
  name: string;
  description: string;
  permissions: readonly string[];
  /**
   * As superfícies em que o papel entra.
   *
   * O painel web é da administração da operação — cliente, contrato, plano,
   * equipe. O técnico operacional e o auxiliar não têm trabalho lá, e deixá-los
   * entrar dava a quem recebeu uma senha temporária para o celular a visão da
   * organização inteira.
   */
  allowedSurfaces: readonly RoleSurface[];
}

export const OWNER_ROLE_KEY = 'OWNER';
export const FIELD_TECHNICIAN_ROLE_KEY = 'FIELD_TECHNICIAN';
export const ASSISTANT_TECHNICIAN_ROLE_KEY = 'ASSISTANT_TECHNICIAN';

/**
 * Os papéis atribuíveis a quem o owner cadastra.
 *
 * `OWNER` fica de fora **de propósito**: quem cria a organização é o dono, e
 * conceder `*` pela tela de equipe daria a outra pessoa o poder de remover quem
 * a cadastrou. Trocar o dono é decisão de outra ordem, e não existe em contrato.
 */
export const ASSIGNABLE_TEAM_ROLES: readonly TeamRoleSeed[] = [
  {
    key: FIELD_TECHNICIAN_ROLE_KEY,
    name: 'Técnico operacional',
    description:
      'Executa o atendimento em campo: abre, preenche o checklist, registra material, emite e fecha.',
    permissions: [...LEITURA_DE_CAMPO, ...EXECUCAO_DE_CAMPO],
    allowedSurfaces: FIELD_ONLY_SURFACES,
  },
  {
    key: ASSISTANT_TECHNICIAN_ROLE_KEY,
    name: 'Técnico auxiliar',
    description:
      'Acompanha o atendimento: vê o que foi atribuído, abre a rota e compartilha o documento já emitido. Não executa nem emite.',
    permissions: [...LEITURA_DE_CAMPO],
    allowedSurfaces: FIELD_ONLY_SURFACES,
  },
];
