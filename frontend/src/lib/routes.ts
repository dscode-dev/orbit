/**
 * Mapa de rotas protegidas e públicas.
 *
 * Fonte única usada pelo middleware. Ao criar uma área nova da aplicação,
 * registre-a aqui — e mantenha o `matcher` em `proxy.ts` alinhado, já que o
 * Next exige valores estáticos naquele arquivo.
 */
export const ROUTES = {
  login: "/login",
  register: "/cadastro",
  dashboard: "/dashboard",
} as const;

/** Áreas que exigem sessão. */
export const PROTECTED_PREFIXES: readonly string[] = ["/dashboard"];

/** Áreas exclusivas de visitantes — usuário autenticado é redirecionado. */
export const GUEST_PREFIXES: readonly string[] = [
  ROUTES.login,
  ROUTES.register,
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isGuestPath(pathname: string): boolean {
  return GUEST_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
