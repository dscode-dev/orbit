/**
 * Em que superfície cada conta pode entrar.
 *
 * ## O buraco que isto fecha
 *
 * O login não olhava o `client` para nada além de registrar a sessão. Um
 * técnico operacional recém-cadastrado — que existe para o aplicativo de campo
 * e recebe uma senha temporária do dono — entrava no painel web e lia a
 * organização inteira: clientes, contratos, financeiro. Nada no backend o
 * impedia; o aplicativo ser o caminho "normal" era a única barreira, e barreira
 * de costume não é barreira.
 *
 * ## A decisão é do papel, não de uma lista de chaves
 *
 * Uma constante com `FIELD_TECHNICIAN` e `ASSISTANT_TECHNICIAN` dentro do
 * código resolveria hoje e falharia amanhã: o dono cria papéis próprios, e o
 * "Ajudante" que ele cadastrar não estaria na lista. A superfície é coluna do
 * papel (`roles.allowed_surfaces`), visível no cadastro e escolhida por quem
 * cria o papel.
 *
 * ## Por que a união, e não a interseção
 *
 * Uma pessoa pode ter papel na organização e papéis por unidade. Quem é
 * administrador na matriz **e** técnico numa filial precisa do painel — negar
 * porque um dos papéis é de campo trancaria quem tem mais acesso, não menos.
 * O papel mais permissivo é o que responde.
 */
import { ForbiddenException } from '../../../exceptions';
import type { IdentityUser } from '../infrastructure/identity.repository';

/** O que o cliente declara ao entrar. Desconhecido é tratado como `WEB`. */
export function normalizeSurface(client: string | undefined): string {
  const valor = (client ?? '').trim().toUpperCase();
  return valor === 'MOBILE' || valor === 'API' ? valor : 'WEB';
}

/**
 * As superfícies que os papéis desta pessoa abrem.
 *
 * Vazio significa "nenhum papel" — quem não tem papel nenhum não é barrado
 * aqui: isso é assunto de autorização, e trancar a entrada por ausência de
 * papel produziria uma conta impossível de diagnosticar. Ausência devolve o
 * conjunto vazio, e quem chama decide.
 */
export function surfacesOf(user: IdentityUser): ReadonlySet<string> {
  const superficies = new Set<string>();
  for (const papel of [
    ...user.organizationMemberships.map((m) => m.role),
    ...user.businessUnitMemberships.map((m) => m.role),
    ...user.platformRoleAssignments.map((a) => a.role),
  ]) {
    for (const superficie of papel?.allowedSurfaces ?? []) {
      superficies.add(superficie.toUpperCase());
    }
  }
  return superficies;
}

/**
 * Esta conta pode entrar por aqui?
 *
 * Sem papel algum, sim: a restrição existe para separar campo de escritório,
 * e não para ser um segundo portão de autorização. Com papéis, ao menos um
 * deles precisa abrir a superfície pedida.
 */
export function allowsSurface(user: IdentityUser, client: string | undefined) {
  const superficies = surfacesOf(user);
  if (superficies.size === 0) return true;
  return superficies.has(normalizeSurface(client));
}

/**
 * A recusa de superfície.
 *
 * `403`, e não `401`: a credencial está certa. Repetir a senha não resolve, e
 * um `401` mandaria o cliente para a tela de login de novo, num laço.
 *
 * A mensagem diz onde a conta funciona, porque essa é a única ação útil que
 * resta a quem leu. Não vaza nada: quem chegou aqui já autenticou.
 */
export class SurfaceNotAllowedException extends ForbiddenException {
  constructor(surface: string) {
    super(
      surface === 'WEB'
        ? 'Esta conta é do aplicativo Orbit de campo e não acessa o painel web.'
        : 'Esta conta não tem acesso por este aplicativo.',
      'SURFACE_NOT_ALLOWED',
    );
  }
}
