import { endSession, logout, readStoredTokens } from "@/server/auth/session";
import { bffJson } from "@/server/bff/responses";
import { createRouteHandler } from "@/server/bff/route-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = createRouteHandler(async ({ requestId }) => {
  await logout(await readStoredTokens());
  const response = bffJson({ authenticated: false }, requestId);
  endSession(response.cookies);
  return response;
});
