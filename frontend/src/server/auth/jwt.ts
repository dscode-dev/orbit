/**
 * Leitura das claims do access token.
 *
 * A assinatura é verificada exclusivamente pelo backend (`JwtAuthenticationGuard`).
 * Aqui apenas decodificamos o payload para conhecer o escopo ativo
 * (organização, unidade, papéis e permissões) e antecipar a expiração —
 * nunca para autorizar uma operação.
 *
 * Implementado sobre `atob`/`TextDecoder` para funcionar também no middleware
 * (Edge Runtime), onde `Buffer` não existe.
 */
import type { AccessTokenClaims } from "@/types/session";

/** Margem de segurança para renovar o token antes de expirar de fato. */
const EXPIRATION_SKEW_SECONDS = 30;

export function decodeAccessToken(token: string): AccessTokenClaims | null {
  const segments = token.split(".");
  if (segments.length !== 3) return null;
  try {
    const payload: unknown = JSON.parse(decodeBase64Url(segments[1]));
    return isAccessClaims(payload) ? payload : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** `true` quando o token já expirou (ou expira dentro da margem). */
export function isExpired(claims: AccessTokenClaims): boolean {
  if (typeof claims.exp !== "number") return false;
  return claims.exp - EXPIRATION_SKEW_SECONDS <= Math.floor(Date.now() / 1000);
}

export function expiresAtIso(claims: AccessTokenClaims): string | null {
  return typeof claims.exp === "number"
    ? new Date(claims.exp * 1000).toISOString()
    : null;
}

function isAccessClaims(value: unknown): value is AccessTokenClaims {
  if (typeof value !== "object" || value === null) return false;
  const claims = value as Record<string, unknown>;
  return (
    typeof claims.sub === "string" &&
    typeof claims.sid === "string" &&
    claims.type === "access"
  );
}

/** Normaliza listas de claims que podem vir ausentes do token. */
export function claimList(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
