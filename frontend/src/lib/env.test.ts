import { afterEach, describe, expect, it, vi } from "vitest";

import { serverEnv } from "./env";

describe("server release environment", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when the production backend origin is absent", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORBIT_API_URL", "");
    expect(() => serverEnv.backendOrigin).toThrow(/ORBIT_API_URL is required/);
  });

  it("accepts the explicit private Compose API origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORBIT_API_URL", "http://api:5001/api/v1/");
    expect(serverEnv.backendOrigin).toBe("http://api:5001/api/v1");
  });

  it("rejects credentials embedded in a backend URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORBIT_API_URL", "https://user:secret@api.example.test/api/v1");
    expect(() => serverEnv.backendOrigin).toThrow(/absolute HTTP/);
  });

  it("requires secure cookies in production unless local smoke opts in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_COOKIE_SECURE", "false");
    vi.stubEnv("ALLOW_INSECURE_LOCAL_COOKIES", "false");
    expect(() => serverEnv.authCookieSecure).toThrow(
      /ALLOW_INSECURE_LOCAL_COOKIES/,
    );
  });

  it("requires an exact public frontend origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_ORIGIN", "");
    expect(() => serverEnv.frontendOrigin).toThrow(
      /FRONTEND_ORIGIN is required/,
    );

    vi.stubEnv("FRONTEND_ORIGIN", "https://app.example.test/path");
    expect(() => serverEnv.frontendOrigin).toThrow(/exact HTTP/);
  });

  it("permits HTTP only for the explicit local validation runtime", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_ORIGIN", "http://127.0.0.1:3000");
    vi.stubEnv("ALLOW_INSECURE_LOCAL_COOKIES", "true");
    expect(serverEnv.frontendOrigin).toBe("http://127.0.0.1:3000");
  });
});
