/**
 * Serviço de autenticação (rotas `/api/auth/*` do BFF).
 *
 * Nenhum token trafega até o browser: as rotas gravam cookies `HttpOnly` e
 * devolvem apenas o estado da sessão.
 */
import { authClient } from "@/api/client";
import type { LoginInput, RegisterInput, SessionState } from "@/types/session";

export interface AuthResult {
  authenticated: boolean;
}

export const authService = {
  login: (input: LoginInput): Promise<AuthResult> =>
    authClient.post<AuthResult>("/login", input),

  register: (input: RegisterInput): Promise<AuthResult> =>
    authClient.post<AuthResult>("/register", input),

  logout: (): Promise<AuthResult> => authClient.post<AuthResult>("/logout"),

  /** Força a rotação do par de tokens. */
  refresh: (): Promise<AuthResult> => authClient.post<AuthResult>("/refresh"),

  session: (): Promise<SessionState> =>
    authClient.get<SessionState>("/session"),
} as const;
