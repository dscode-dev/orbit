/**
 * Superfície de API exposta pelo proxy do BFF.
 *
 * O proxy não é um túnel aberto: só encaminha os prefixos abaixo, que
 * correspondem aos controllers do NestJS. Ao criar um módulo novo no backend,
 * registre a raiz aqui — é o único ponto a alterar no Frontend Core.
 */

/** Raízes correspondentes aos `@Controller(...)` do backend. */
export const ALLOWED_API_ROOTS: readonly string[] = [
  "ai-agents",
  "ai-executions",
  "analytics",
  "assets",
  "catalog",
  "checklist-executions",
  "checklist-templates",
  "customers",
  "dashboard",
  "identity",
  "integrations",
  "notifications",
  "operations",
  "organizations",
  "plans",
  "report-templates",
  "reports",
  "scheduling",
];

/**
 * Rotas de identidade que emitem ou revogam tokens. Precisam do tratamento de
 * cookies `HttpOnly` das rotas dedicadas (`/api/auth/*`); se passassem pelo
 * proxy genérico, o par de tokens voltaria no corpo da resposta e ficaria
 * acessível ao JavaScript da página.
 */
const TOKEN_ROUTES: readonly string[] = [
  "/identity/login",
  "/identity/register",
  "/identity/refresh",
  "/identity/logout",
];

export type PathVerdict =
  { allowed: true } | { allowed: false; status: 403 | 404; message: string };

export function inspectPath(path: string): PathVerdict {
  const root = path.split("/")[1] ?? "";
  if (!ALLOWED_API_ROOTS.includes(root)) {
    return {
      allowed: false,
      status: 404,
      message: `Recurso "${root}" não é exposto pelo BFF.`,
    };
  }
  if (TOKEN_ROUTES.includes(path.toLowerCase())) {
    return {
      allowed: false,
      status: 403,
      message: "Use as rotas de autenticação em /api/auth.",
    };
  }
  return { allowed: true };
}
