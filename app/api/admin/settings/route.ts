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

  // Validated separately -- an unvalidated value here could leave the server
  // unable to bind on its next start.
  if (typeof body.serverPort === "string" || typeof body.serverPort === "number") {
    const raw = String(body.serverPort).trim();
    if (raw === "") {
      patch.serverPort = "";
    } else {
      const portNum = Number(raw);
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        return NextResponse.json(
          { error: "Port must be a whole number between 1 and 65535." },
          { status: 400 }
        );
      }
      patch.serverPort = String(portNum);
    }
  }

  const settings = await writeSettings(patch);
  return NextResponse.json({ settings });
}
