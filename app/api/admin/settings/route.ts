import { NextResponse } from "next/server";
import { readSettings, writeSettings, type AppSettings } from "@/lib/settings";

const ALLOWED_KEYS: (keyof AppSettings)[] = [
  "githubBackupToken",
  "githubBackupRepo",
  "githubBackupBranch",
  "canvaClientId",
  "canvaClientSecret",
  "canvaRedirectUri",
];

export async function GET() {
  const settings = await readSettings();
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Partial<AppSettings> = {};
  for (const key of ALLOWED_KEYS) {
    if (typeof body[key] === "string") {
      patch[key] = body[key] as string;
    }
  }

  const settings = await writeSettings(patch);
  return NextResponse.json({ settings });
}
