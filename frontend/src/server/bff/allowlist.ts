/**
 * Superfície de API exposta pelo proxy do BFF.
 *
 * O proxy não é um túnel aberto: só encaminha os prefixos abaixo, que
 * correspondem aos controllers do NestJS. Ao criar um módulo novo no backend,
 * registre a raiz aqui — é o único ponto a alterar no Frontend Core.
 */
import type { HttpMethod } from "@/types/api";

/** Raízes correspondentes aos `@Controller(...)` do backend. */
export const ALLOWED_API_ROOTS: readonly string[] = [
  "ai-agents",
  "ai-executions",
  "analytics",
  "artifact-executions",
  "artifact-templates",
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
  "platform-admin",
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

/**
 * Endpoints marcados com `@Public()` no backend, encaminhados sem sessão.
 *
 * São os fluxos que acontecem justamente quando o usuário não está
 * autenticado: escolha de plano no onboarding, recuperação de senha e aceite
 * de convite. A correspondência é exata (método + caminho) para que o proxy
 * continue exigindo sessão em todo o resto.
 */
const PUBLIC_ENDPOINTS: ReadonlySet<string> = new Set([
  "GET /plans",
  "POST /identity/password/forgot",
  "POST /identity/password/reset",
  "POST /identity/invitations/accept",
]);

export type PathVerdict =
  | { allowed: true; requiresSession: boolean }
  | { allowed: false; status: 403 | 404; message: string };

export function inspectPath(path: string, method: HttpMethod): PathVerdict {
  const root = path.split("/")[1] ?? "";
  if (!ALLOWED_API_ROOTS.includes(root)) {
    return {
      allowed: false,
      status: 404,
      message: `Recurso "${root}" não é exposto pelo BFF.`,
    };
  }
  const normalized = path.toLowerCase();
  if (TOKEN_ROUTES.includes(normalized)) {
    return {
      allowed: false,
      status: 403,
      message: "Use as rotas de autenticação em /api/auth.",
    };
  }
  return {
    allowed: true,
    requiresSession: !PUBLIC_ENDPOINTS.has(`${method} ${normalized}`),
  };
}
