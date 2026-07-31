import { persistSession, register } from "@/server/auth/session";
import { bffJson } from "@/server/bff/responses";
import { createRouteHandler } from "@/server/bff/route-handler";
import type { RegisterInput } from "@/types/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = createRouteHandler(async ({ json, requestId }) => {
  const tokens = await register(await json<RegisterInput>());
  const response = bffJson({ authenticated: true }, requestId, 201);
  persistSession(response.cookies, tokens);
  return response;
});
