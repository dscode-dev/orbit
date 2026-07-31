/**
 * Configuração de ambiente do Frontend Core.
 *
 * `serverEnv` só pode ser lido em código de servidor (Route Handlers,
 * middleware, Server Components). O browser usa apenas `publicEnv`.
 */

const DEFAULT_BACKEND_ORIGIN = "http://localhost:3001";

/** Prefixo do BFF. Todo tráfego do browser passa por aqui. */
export const BFF_BASE_PATH = "/api/orbit";

/** Rotas de autenticação do BFF (fora do proxy genérico). */
export const BFF_AUTH_PATH = "/api/auth";

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000;
export const DEFAULT_LOCALE = "pt-BR";
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Limite aplicado pelo backend em `FileInterceptor` (20 MB). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function isServer(): boolean {
  return typeof window === "undefined";
}

export function assertServer(context: string): void {
  if (!isServer()) {
    throw new Error(
      `${context} só pode ser executado no servidor. Use o cliente do BFF (@/api).`,
    );
  }
}

export const serverEnv = {
  /** URL interna do NestJS. Nunca exposta ao browser. */
  get backendOrigin(): string {
    assertServer("serverEnv.backendOrigin");
    const origin = process.env.ORBIT_API_URL ?? DEFAULT_BACKEND_ORIGIN;
    return origin.replace(/\/+$/, "");
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
} as const;

export const publicEnv = {
  bffBasePath: BFF_BASE_PATH,
  authBasePath: BFF_AUTH_PATH,
} as const;

/** Monta uma URL absoluta para o backend a partir de um path da API. */
export function backendUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${serverEnv.backendOrigin}${normalized}`;
}
