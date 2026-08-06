import { NextResponse } from "next/server";
import { exec } from "child_process";
import { mkdir } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export async function GET() {
  return NextResponse.json({ path: UPLOADS_DIR });
}

// Opens the uploads folder in Explorer on the machine running the server.
// Only meaningful for a local Windows install where /admin is opened on
// that same PC -- explorer.exe doesn't exist on the Linux containers a
// hosted deployment runs on, and even on Windows this just opens a window
// on the server, invisible to whoever clicked it from another device.
export async function POST() {
  if (process.platform !== "win32") {
    return NextResponse.json(
      { ok: false, unavailable: true, path: UPLOADS_DIR },
      { status: 501 }
    );
  }
  await mkdir(UPLOADS_DIR, { recursive: true });
  exec(`explorer.exe "${UPLOADS_DIR}"`, () => {
    // explorer.exe routinely reports a non-zero exit even when it opens
    // the window successfully, so there's nothing useful to check here.
  });
  return NextResponse.json({ ok: true, path: UPLOADS_DIR });
}
