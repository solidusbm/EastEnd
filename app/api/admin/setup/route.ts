import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, createSessionToken, hasAdminPassword, setAdminPassword } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
  if (await hasAdminPassword()) {
    return NextResponse.json({ error: "An admin account already exists." }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const password = body.password;
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 }
    );
  }

  await setAdminPassword(password);

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  if (token) {
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      // Not tied to NODE_ENV -- see app/api/admin/login/route.ts.
      secure: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
