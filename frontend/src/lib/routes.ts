/**
 * Mapa de rotas da aplicação.
 *
 * Fonte única usada pelo middleware, pelos guards e pelos redirecionamentos.
 * Ao criar uma área nova, registre-a aqui — e mantenha o `matcher` em
 * `proxy.ts` alinhado, já que o Next exige valores estáticos naquele arquivo.
 */
export const ROUTES = {
  home: "/",
  login: "/login",
  register: "/cadastro",
  forgotPassword: "/recuperar-senha",
  resetPassword: "/redefinir-senha",
  invitation: "/convite",
  dashboard: "/dashboard",
  operations: "/operacoes",
  /** Landing do Platform Administrator (painel será implementado adiante). */
  platform: "/plataforma",
  designSystem: "/design-system",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/** Áreas de tenant — exigem sessão e organização. */
export const PROTECTED_PREFIXES: readonly string[] = [
  ROUTES.dashboard,
  ROUTES.operations,
];

/** Áreas exclusivas do Platform Administrator. */
export const PLATFORM_PREFIXES: readonly string[] = [
  ROUTES.platform,
  ROUTES.designSystem,
];

/** Áreas exclusivas de visitantes — usuário autenticado é redirecionado. */
export const GUEST_PREFIXES: readonly string[] = [
  ROUTES.login,
  ROUTES.register,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  ROUTES.invitation,
];

/**
 * Rotas que um usuário autenticado ainda pode abrir.
 *
 * Redefinir senha e aceitar convite podem acontecer com sessão ativa — quem
 * está logado e clica no link do e-mail não deve ser expulso para o dashboard.
 */
const GUEST_ALLOWED_WHEN_AUTHENTICATED: readonly string[] = [
  ROUTES.resetPassword,
  ROUTES.invitation,
];

const startsWith = (pathname: string, prefixes: readonly string[]): boolean =>
  prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

export function isProtectedPath(pathname: string): boolean {
  return startsWith(pathname, PROTECTED_PREFIXES);
}

export function isPlatformPath(pathname: string): boolean {
  return startsWith(pathname, PLATFORM_PREFIXES);
}

export function isGuestPath(pathname: string): boolean {
  return startsWith(pathname, GUEST_PREFIXES);
}

export function allowsAuthenticatedGuest(pathname: string): boolean {
  return startsWith(pathname, GUEST_ALLOWED_WHEN_AUTHENTICATED);
}

/** Destino padrão após autenticar, conforme o tipo de conta. */
export function homeRouteFor(options: { isPlatformAdmin: boolean }): string {
  return options.isPlatformAdmin ? ROUTES.platform : ROUTES.dashboard;
}

/** Motivo do redirecionamento para o login, exibido na tela. */
export const LOGIN_REASON_PARAM = "motivo";

export const LoginReason = {
  expired: "sessao-expirada",
  unauthorized: "sem-acesso",
} as const;

export type LoginReason = (typeof LoginReason)[keyof typeof LoginReason];

export function loginUrl(reason?: LoginReason, redirectTo?: string): string {
  const params = new URLSearchParams();
  if (reason) params.set(LOGIN_REASON_PARAM, reason);
  if (redirectTo && redirectTo !== ROUTES.login)
    params.set("destino", redirectTo);
  const query = params.toString();
  return query ? `${ROUTES.login}?${query}` : ROUTES.login;
}
