/**
 * Único ponto de entrada do browser para a API do Orbit.
 *
 * `/api/orbit/<rota-do-backend>` → NestJS, com sessão, contexto e erros
 * tratados em `@/server/bff/proxy`.
 */
import type { NextRequest } from "next/server";

import { proxyToBackend, type ProxyRouteContext } from "@/server/bff/proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const handler = (
  request: NextRequest,
  context: ProxyRouteContext,
): Promise<Response> => proxyToBackend(request, context);

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as HEAD,
};
