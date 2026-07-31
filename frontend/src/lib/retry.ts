/**
 * Política de retry compartilhada pelo cliente HTTP e pelo TanStack Query.
 *
 * Só reenviamos requisições idempotentes e apenas em falhas transitórias:
 * rede indisponível, timeout, 408, 429 e 5xx (exceto 501).
 */
import type { HttpMethod } from "@/types/api";
import { ApiError, isApiError } from "./api-error";

export const IDEMPOTENT_METHODS: readonly HttpMethod[] = [
  "GET",
  "HEAD",
  "PUT",
  "DELETE",
];

export const DEFAULT_RETRIES = 2;
const BASE_DELAY_MS = 300;
const MAX_DELAY_MS = 8_000;

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isIdempotent(method: HttpMethod): boolean {
  return IDEMPOTENT_METHODS.includes(method);
}

export function defaultRetriesFor(method: HttpMethod): number {
  return isIdempotent(method) ? DEFAULT_RETRIES : 0;
}

/** Um erro é reenviável quando é transitório e não foi cancelado. */
export function isRetryableError(error: unknown): boolean {
  if (!isApiError(error)) return false;
  if (error.kind === "aborted") return false;
  if (error.kind === "network" || error.kind === "timeout") return true;
  return RETRYABLE_STATUS.has(error.status);
}

/** Backoff exponencial com jitter completo. */
export function retryDelay(attempt: number, retryAfterMs?: number): number {
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs)) {
    return Math.min(retryAfterMs, MAX_DELAY_MS);
  }
  const ceiling = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

/** Lê `Retry-After` (segundos ou data HTTP) em milissegundos. */
export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new ApiError({ kind: "aborted", message: "Requisição cancelada." }),
      );
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(
        new ApiError({ kind: "aborted", message: "Requisição cancelada." }),
      );
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
