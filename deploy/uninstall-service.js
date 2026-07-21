// Removes the "EastEndTVSignage" Windows Service. Must be run from an
// Administrator PowerShell/Command Prompt.
const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "EastEndTVSignage",
  script: path.join(__dirname, "run-server.js"),
});

svc.on("uninstall", () => {
  console.log("Service uninstalled.");
});

svc.on("error", (err) => {
  console.error("Service error:", err);
});

console.log("Uninstalling EastEndTVSignage service (requires Administrator)...");
svc.uninstall();
