import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, createSessionToken, hasAdminPassword, verifyAdminPassword } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await hasAdminPassword())) {
    return NextResponse.json(
      { error: "No admin account exists yet. Visit /admin/setup to create one." },
      { status: 400 }
    );
  }

  let password: unknown;
  try {
    const body = await request.json();
    password = body?.password;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof password !== "string" || !(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

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
