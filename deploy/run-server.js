// Entry point the Windows Service launches. node-windows needs a plain
// script to run with `node`, not a package.json script, so this just spawns
// `next start` bound to all network interfaces (not just localhost) so TVs
// on the restaurant's LAN can reach it. Invoking Next's CLI script directly
// with `node` (rather than the next.cmd shim via a shell) avoids needing
// `shell: true`, which Node flags as a command-injection risk.
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.join(__dirname, "..");
const port = process.env.PORT || "3000";
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
