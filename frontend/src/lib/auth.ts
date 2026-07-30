export const ACCESS_COOKIE = "orbit_access";
export const REFRESH_COOKIE = "orbit_refresh";

export const accessCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 15 * 60,
};

export const refreshCookieOptions = {
  ...accessCookieOptions,
  maxAge: 30 * 24 * 60 * 60,
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export function backendUrl(path: string) {
  const origin = process.env.ORBIT_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return `${origin.replace(/\/$/, "")}${path}`;
}

export async function backendRequest(path: string, init?: RequestInit) {
  return fetch(backendUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

export async function readApiError(response: Response) {
  const fallback = "Não foi possível concluir a solicitação.";
  try {
    const payload = (await response.json()) as {
      error?: { message?: string | string[] };
      message?: string | string[];
    };
    const message = payload.error?.message ?? payload.message;
    return Array.isArray(message) ? message.join(". ") : message ?? fallback;
  } catch {
    return fallback;
  }
}

export function isTrustedBrowserRequest(request: Request) {
  return request.headers.get("sec-fetch-site") !== "cross-site";
}
