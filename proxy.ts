import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, hasAdminPassword, isValidSessionToken } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Setup always passes through -- the page/route itself refuses to run
  // again once an account exists, so there's no need to gate it here.
  if (pathname === "/admin/setup" || pathname === "/api/admin/setup") {
    return NextResponse.next();
  }

  if (!(await hasAdminPassword())) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Admin account not set up yet." }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/admin/setup", request.url));
  }

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await isValidSessionToken(token);

  if (valid) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
