import { NextResponse } from "next/server";
import { testGithubBackupConnection } from "@/lib/githubBackup";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = body.token;
  const repo = body.repo;
  if (typeof token !== "string" || !token || typeof repo !== "string" || !repo) {
    return NextResponse.json({ error: "Token and repo are required." }, { status: 400 });
  }

  const result = await testGithubBackupConnection(token, repo);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
