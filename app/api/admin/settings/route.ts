import { NextResponse } from "next/server";
import { readSettings, writeSettings, type AppSettings } from "@/lib/settings";
import { LABEL_FONT_FAMILIES } from "@/lib/labelStyle";

const ALLOWED_KEYS: (keyof AppSettings)[] = [
  "githubBackupToken",
  "githubBackupRepo",
  "githubBackupBranch",
  "canvaClientId",
  "canvaClientSecret",
  "canvaRedirectUri",
];

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

  if (typeof body.labelFontFamily === "string") {
    if (!LABEL_FONT_FAMILIES.includes(body.labelFontFamily as (typeof LABEL_FONT_FAMILIES)[number])) {
      return NextResponse.json(
        { error: `labelFontFamily must be one of: ${LABEL_FONT_FAMILIES.join(", ")}.` },
        { status: 400 }
      );
    }
    patch.labelFontFamily = body.labelFontFamily;
  }

  for (const key of ["labelTextColor", "labelBackgroundColor"] as const) {
    if (typeof body[key] === "string") {
      if (!HEX_COLOR_PATTERN.test(body[key] as string)) {
        return NextResponse.json({ error: `${key} must be a hex color like #rrggbb.` }, { status: 400 });
      }
      patch[key] = body[key] as string;
    }
  }

  if (typeof body.labelFontSize === "string" || typeof body.labelFontSize === "number") {
    const num = Number(body.labelFontSize);
    if (!Number.isInteger(num) || num < 8 || num > 200) {
      return NextResponse.json({ error: "labelFontSize must be a whole number between 8 and 200." }, { status: 400 });
    }
    patch.labelFontSize = String(num);
  }

  if (typeof body.labelBackgroundOpacity === "string" || typeof body.labelBackgroundOpacity === "number") {
    const num = Number(body.labelBackgroundOpacity);
    if (!Number.isInteger(num) || num < 0 || num > 100) {
      return NextResponse.json({ error: "labelBackgroundOpacity must be a whole number between 0 and 100." }, { status: 400 });
    }
    patch.labelBackgroundOpacity = String(num);
  }

  const settings = await writeSettings(patch);
  return NextResponse.json({ settings });
}
