/**
 * Utilitários HTTP puros — sem dependência de browser ou de servidor.
 */
import type { QueryParams, QueryValue } from "@/types/api";

/** Serializa a query string ignorando `null`/`undefined`/string vazia. */
export function serializeQuery(query?: QueryParams): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    appendQueryValue(params, key, value);
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function appendQueryValue(
  params: URLSearchParams,
  key: string,
  value: QueryValue,
): void {
  if (value === null || value === undefined || value === "") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item === null || item === undefined || item === "") continue;
      params.append(key, String(item));
    }
    return;
  }
  if (value instanceof Date) {
    params.append(key, value.toISOString());
    return;
  }
  params.append(key, String(value));
}

/** Normaliza um path da API garantindo uma única barra inicial. */
export function normalizePath(path: string): string {
  const trimmed = path.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Reconstrói o path a partir dos segmentos capturados pelo proxy,
 * bloqueando travessia de diretório e segmentos vazios.
 */
export function buildSafePath(segments: readonly string[]): string | null {
  if (segments.length === 0) return null;
  const parts: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") return null;
    if (segment.includes("/") || segment.includes("\\")) return null;
    parts.push(encodeURIComponent(segment));
  }
  return `/${parts.join("/")}`;
}

/** Gera um identificador de requisição (UUID v4) aceito pelo backend. */
export function generateRequestId(): string {
  const globalCrypto = globalThis.crypto;
  if (typeof globalCrypto?.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalCrypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Extrai o nome do arquivo de um cabeçalho `Content-Disposition`. */
export function parseContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      return encoded[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

/** Combina múltiplos `AbortSignal` em um só (compatível com todos os alvos). */
export function combineSignals(
  signals: ReadonlyArray<AbortSignal | undefined>,
): { signal: AbortSignal; dispose: () => void } {
  const active = signals.filter((item): item is AbortSignal => Boolean(item));
  const controller = new AbortController();
  const aborted = active.find((signal) => signal.aborted);
  if (aborted) {
    controller.abort(aborted.reason);
    return { signal: controller.signal, dispose: () => undefined };
  }
  const listeners = active.map((signal) => {
    const onAbort = (): void => controller.abort(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    return { signal, onAbort };
  });
  return {
    signal: controller.signal,
    dispose: () => {
      for (const { signal, onAbort } of listeners) {
        signal.removeEventListener("abort", onAbort);
      }
    },
  };
}

/** Indica se o corpo da resposta deve ser lido como JSON. */
export function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get("content-type");
  return Boolean(contentType && contentType.includes("json"));
}
