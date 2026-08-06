// Entry point the Windows Service launches. node-windows needs a plain
// script to run with `node`, not a package.json script, so this just spawns
// `next start` bound to all network interfaces (not just localhost) so TVs
// on the local network can reach it. Invoking Next's CLI script directly
// with `node` (rather than the next.cmd shim via a shell) avoids needing
// `shell: true`, which Node flags as a command-injection risk.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.join(__dirname, "..");

// Port precedence: data/settings.json's serverPort (set from Setup in the
// browser) > PORT env var > 3000. Read directly rather than importing
// lib/settings.ts, since this plain script runs outside Next/TypeScript.
function getConfiguredPort() {
  try {
    const raw = fs.readFileSync(path.join(projectRoot, "data", "settings.json"), "utf-8");
    const settings = JSON.parse(raw);
    if (settings.serverPort && String(settings.serverPort).trim() !== "") {
      return String(settings.serverPort).trim();
    }
  } catch {
    // No settings file yet, or it's unreadable -- fall through.
  }
  return process.env.PORT || "3000";
}

const port = getConfiguredPort();
const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextCli, "start", "-p", port, "-H", "0.0.0.0"], {
  cwd: projectRoot,
  stdio: "inherit",
});

child.on("error", (err) => {
  console.error("Failed to start Next.js server:", err);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code === null ? 1 : code);
});
