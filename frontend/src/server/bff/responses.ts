/**
 * Respostas do BFF.
 *
 * Erros gerados no próprio BFF usam exatamente o mesmo envelope do backend,
 * para que o cliente tenha um único formato a interpretar.
 */
import { NextResponse } from "next/server";

import { CONTEXT_HEADERS } from "@/lib/context-headers";
import type { ApiErrorEnvelope } from "@/types/api";

export interface BffErrorInit {
  status: number;
  code: string;
  message: string;
  requestId: string;
  details?: unknown;
}

export function bffError(init: BffErrorInit): NextResponse<ApiErrorEnvelope> {
  const body: ApiErrorEnvelope = {
    success: false,
    error: { code: init.code, message: init.message, details: init.details },
    requestId: init.requestId,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body, {
    status: init.status,
    headers: { [CONTEXT_HEADERS.requestId]: init.requestId },
  });
}

export function bffJson<T>(
  data: T,
  requestId: string,
  status = 200,
): NextResponse {
  return NextResponse.json(
    { success: true, data, requestId, timestamp: new Date().toISOString() },
    { status, headers: { [CONTEXT_HEADERS.requestId]: requestId } },
  );
}

/**
 * Requisições devem partir da própria aplicação. `sec-fetch-site` é enviado
 * por todos os browsers suportados; ausência do cabeçalho indica cliente
 * não-browser, que também não deve usar o BFF.
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site === "same-origin" || site === "same-site" || site === "none";
}
