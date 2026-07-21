// Registers this app as a Windows Service named "EastEndTVSignage" that
// starts on boot and restarts itself if it ever crashes. Must be run from
// an Administrator PowerShell/Command Prompt — Windows Service registration
// requires elevation.
const path = require("path");
const { Service } = require("node-windows");

const svc = new Service({
  name: "EastEndTVSignage",
  description: "Local web server for the EastEnd restaurant TV menu signage app.",
  script: path.join(__dirname, "run-server.js"),
  wait: 2,
  grow: 0.25,
  maxRestarts: 1000,
});

svc.on("install", () => {
  console.log("Service installed. Starting it now...");
  svc.start();
});

svc.on("alreadyinstalled", () => {
  console.log("Service is already installed. Run uninstall-service.js first if you need to reinstall.");
});

svc.on("start", () => {
  console.log("Service started. The app should be reachable at http://localhost:3000 shortly.");
});

svc.on("error", (err) => {
  console.error("Service error:", err);
});

console.log("Installing EastEndTVSignage as a Windows Service (requires Administrator)...");
svc.install();
