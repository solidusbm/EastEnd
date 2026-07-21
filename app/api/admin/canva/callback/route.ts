import { NextResponse } from "next/server";
import { exchangeCodeForTokens, getCanvaConfig } from "@/lib/canva";

const PENDING_COOKIE = "canva_oauth_pending";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const redirectTo = new URL("/admin", request.url);

  const config = getCanvaConfig();
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const pendingRaw = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${PENDING_COOKIE}=`))
    ?.slice(PENDING_COOKIE.length + 1);

  let pending: { state: string; codeVerifier: string } | null = null;
  if (pendingRaw) {
    try {
      pending = JSON.parse(decodeURIComponent(pendingRaw));
    } catch {
      pending = null;
    }
  }

  if (!config || !code || !state || !pending || pending.state !== state) {
    redirectTo.searchParams.set("canva", "error");
  } else {
    try {
      await exchangeCodeForTokens(config, code, pending.codeVerifier);
      redirectTo.searchParams.set("canva", "connected");
    } catch (err) {
      console.error("[canva] Token exchange failed:", err);
      redirectTo.searchParams.set("canva", "error");
    }
  }

  const response = NextResponse.redirect(redirectTo);
  response.cookies.delete(PENDING_COOKIE);
  return response;
}
