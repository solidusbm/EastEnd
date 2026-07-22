import { NextResponse } from "next/server";
import { buildAuthorizationUrl, createPkceChallenge, getCanvaConfig } from "@/lib/canva";

const PENDING_COOKIE = "canva_oauth_pending";

export async function GET(request: Request) {
  const config = await getCanvaConfig();
  if (!config) {
    const url = new URL("/admin", request.url);
    url.searchParams.set("canva", "not-configured");
    return NextResponse.redirect(url);
  }

  const pkce = createPkceChallenge();
  const authorizeUrl = buildAuthorizationUrl(config, pkce);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(
    PENDING_COOKIE,
    JSON.stringify({ state: pkce.state, codeVerifier: pkce.codeVerifier }),
    {
      httpOnly: true,
      // Not tied to NODE_ENV -- see app/api/admin/login/route.ts.
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    }
  );
  return response;
}
