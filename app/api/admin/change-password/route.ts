import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, createSessionToken, setAdminPassword } from "@/lib/auth";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(request: Request) {
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

  // Changing the password rotates the session-signing secret, invalidating
  // the caller's own cookie too -- issue a fresh one so they're not
  // unexpectedly logged out immediately after changing it themselves.
  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  if (token) {
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}
