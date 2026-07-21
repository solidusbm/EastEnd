// Runs once when the Next.js server process starts (see
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
// Used here to kick off the background poller that keeps Canva-linked
// images in sync -- Canva has no "design changed" webhook, so periodic
// polling is the only option (see lib/canvaSync.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCanvaSyncPoller } = await import("./lib/canvaSync");
    startCanvaSyncPoller();
  }
}
