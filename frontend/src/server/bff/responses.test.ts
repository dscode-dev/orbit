import { afterEach, describe, expect, it, vi } from "vitest";

import { isSameOriginRequest } from "./responses";

const request = (method: string, site: string | null, origin: string | null) =>
  new Request("https://app.example.test/api/orbit/operations", {
    method,
    headers: {
      ...(site ? { "sec-fetch-site": site } : {}),
      ...(origin ? { origin } : {}),
    },
  });

describe("BFF origin validation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts an unsafe method only from the exact application origin", () => {
    expect(
      isSameOriginRequest(
        request("POST", "same-origin", "https://app.example.test"),
      ),
    ).toBe(true);
  });

  it.each([
    request("POST", "cross-site", "https://evil.example"),
    request("POST", "same-site", "https://sibling.example.test"),
    request("POST", "same-origin", null),
    request("POST", null, "https://app.example.test"),
  ])("rejects ambiguous or foreign unsafe requests", (input) => {
    expect(isSameOriginRequest(input)).toBe(false);
  });

  it("allows same-origin navigation reads without weakening writes", () => {
    expect(isSameOriginRequest(request("GET", "same-origin", null))).toBe(true);
    expect(isSameOriginRequest(request("GET", "none", null))).toBe(true);
  });

  it("uses the configured public origin behind a private reverse proxy", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_ORIGIN", "https://app.example.test");

    const proxied = new Request("http://frontend:3000/api/auth/login", {
      method: "POST",
      headers: {
        origin: "https://app.example.test",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(isSameOriginRequest(proxied)).toBe(true);
  });

  it("rejects an origin different from the configured public origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("FRONTEND_ORIGIN", "https://app.example.test");

    expect(
      isSameOriginRequest(
        request("POST", "same-origin", "https://sibling.example.test"),
      ),
    ).toBe(false);
  });
});
