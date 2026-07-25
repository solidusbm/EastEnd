// Runs once when the Next.js server process starts (see
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
// Used here to kick off two background pollers: one keeps Canva-linked
// images in sync (Canva has no "design changed" webhook, so periodic
// polling is the only option -- see lib/canvaSync.ts), the other mirrors
// screens/images managed from the hosted admin panel's Signage tab into
// this app's local store so the TVs (which load from here) stay current
// (see lib/signageSync.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCanvaSyncPoller } = await import("./lib/canvaSync");
    startCanvaSyncPoller();

    const { startSignageSyncPoller } = await import("./lib/signageSync");
    startSignageSyncPoller();
  }
}
