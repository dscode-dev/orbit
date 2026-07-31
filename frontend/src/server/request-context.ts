/**
 * Contexto de requisição encaminhado do BFF para o NestJS.
 *
 * Cabeçalhos e como o backend os consome hoje:
 *
 * | Cabeçalho             | Consumo no backend                                        |
 * | --------------------- | --------------------------------------------------------- |
 * | `authorization`       | `JwtAuthenticationGuard` — identidade, escopo e permissões |
 * | `x-request-id`        | `RequestIdInterceptor` — correlação ponta a ponta          |
 * | `accept-language`     | `RequestContextInterceptor` — `RequestContext.locale`      |
 * | `x-timezone`          | propagado para observabilidade (ainda não lido)            |
 * | `x-organization-id`   | propagado para observabilidade (ainda não lido)            |
 * | `x-business-unit-id`  | propagado para observabilidade (ainda não lido)            |
 *
 * O escopo multi-tenant efetivo (organização/unidade) e o RLS derivam sempre
 * das claims do access token, nunca destes cabeçalhos. Eles existem para
 * correlacionar logs e para que o backend possa passar a validá-los sem
 * mudanças no frontend.
 */
import { CONTEXT_HEADERS } from "@/lib/context-headers";
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE } from "@/lib/env";
import { generateRequestId } from "@/utils/http";
import type { OrbitRequestContext } from "@/types/api";

export { CONTEXT_HEADERS };

export interface BackendContextInput extends Partial<OrbitRequestContext> {
  accessToken?: string | null;
}

/** Monta os cabeçalhos de contexto de uma chamada ao backend. */
export function backendContextHeaders(
  input: BackendContextInput = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    [CONTEXT_HEADERS.requestId]: input.requestId ?? generateRequestId(),
    [CONTEXT_HEADERS.locale]: input.locale ?? DEFAULT_LOCALE,
    [CONTEXT_HEADERS.timezone]: input.timezone ?? DEFAULT_TIMEZONE,
  };
  if (input.organizationId) {
    headers[CONTEXT_HEADERS.organizationId] = input.organizationId;
  }
  if (input.businessUnitId) {
    headers[CONTEXT_HEADERS.businessUnitId] = input.businessUnitId;
  }
  if (input.accessToken) {
    headers.authorization = `Bearer ${input.accessToken}`;
  }
  return headers;
}

/** Lê o contexto enviado pelo browser, aplicando os padrões da aplicação. */
export function readContextFromRequest(
  request: Request,
): Required<Omit<OrbitRequestContext, "organizationId" | "businessUnitId">> &
  Pick<OrbitRequestContext, "organizationId" | "businessUnitId"> {
  const header = (name: string): string | null =>
    request.headers.get(name)?.trim() || null;
  const requestId = header(CONTEXT_HEADERS.requestId);
  return {
    requestId:
      requestId && requestId.length <= 128 ? requestId : generateRequestId(),
    locale: header(CONTEXT_HEADERS.locale) ?? DEFAULT_LOCALE,
    timezone: header(CONTEXT_HEADERS.timezone) ?? DEFAULT_TIMEZONE,
    organizationId: header(CONTEXT_HEADERS.organizationId),
    businessUnitId: header(CONTEXT_HEADERS.businessUnitId),
  };
}
