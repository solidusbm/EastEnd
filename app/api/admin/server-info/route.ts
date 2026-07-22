import { NextRequest, NextResponse } from "next/server";
import os from "os";
import { readSettings } from "@/lib/settings";

// The port actually in use right now -- read off the request itself (the
// Host header the browser dialed) rather than guessed from env vars, since
// nothing reliably tells us how `next start`/`next dev` were invoked.
export async function GET(request: NextRequest) {
  const hostHeader = request.headers.get("host") ?? "";
  const currentPort = hostHeader.split(":")[1] || "3000";

  const addresses: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const iface of entries ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  const settings = await readSettings();

  return NextResponse.json({
    currentPort,
    addresses,
    configuredPort: settings.serverPort ?? "",
  });
}
