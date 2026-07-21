# Deploying to the restaurant's Windows PC

This app now stores everything (config + uploaded images) on local disk
(`data/config.json` and `public/uploads/`), so it runs fully offline — no
Vercel account or internet connection needed once it's set up. These steps
turn a Windows PC into a dedicated, always-on signage server that TVs on the
restaurant's network point their browsers at.

## Quick setup (recommended)

1. Copy this whole project folder onto the PC, e.g. to `C:\EastEndSignage`
   (zip it up and copy via USB drive, or `git clone` if the PC has git and
   access to the repo).
2. If migrating from an earlier Vercel-hosted version, copy its old
   `data/config.json` and `public/uploads/` contents into this folder's
   `data/` and `public/uploads/` first. Skip this for a fresh setup.
3. Double-click **`deploy\setup.bat`**. It'll prompt for admin permission
   (needed to install the Windows Service and firewall rule), then runs
   through everything below automatically: installs Node.js if missing,
   `npm install`, asks for an admin password on first run, builds for
   production, registers/restarts the `EastEndTVSignage` Windows Service,
   opens the firewall, and prints the LAN URLs to use.

Re-run `setup.bat` any time you copy in an updated version of the app — it
rebuilds and restarts the service instead of reinstalling from scratch, and
won't ask for the admin password again once it's set.

If double-clicking is blocked or you'd rather run it from a terminal
yourself: open PowerShell **as Administrator**, `cd` into the project
folder, and run `powershell -ExecutionPolicy Bypass -File deploy\setup.ps1`.

## Manual setup (what the script above does, step by step)

Useful if you want to understand or troubleshoot a step individually.

### 1. Get Node.js onto the PC

Download and install the **LTS** version from https://nodejs.org (or, if
`winget` is available: `winget install OpenJS.NodeJS.LTS`). Restart the
terminal after installing so `node`/`npm` are on PATH.

### 2. Install dependencies and configure the admin password

In a PowerShell window, `cd` into the folder, then:

```powershell
npm install
Copy-Item .env.example .env.local
notepad .env.local
```

Set `ADMIN_PASSWORD` to whatever password staff should use to log into
`/admin`. Save and close.

### 3. Build for production

```powershell
npm run build
```

Re-run this any time you change the app's code (not needed for day-to-day
image/screen edits through `/admin` — those just write to `data/` and
`public/uploads/` directly).

### 4. Install as an auto-starting Windows Service

Open PowerShell **as Administrator** (right-click → Run as Administrator),
`cd` into the project folder, then:

```powershell
npm run service:install
```

This registers a service called `EastEndTVSignage` that starts automatically
on boot and restarts itself if it ever crashes — no one needs to remember to
launch anything. You can confirm it's running via `services.msc` (look for
"EastEndTVSignage") or by visiting http://localhost:3000/admin on the PC.

To remove it later (e.g. before reinstalling), also as Administrator:

```powershell
npm run service:uninstall
```

### 5. Open the firewall for other devices on the network

By default Windows Firewall blocks other devices (the TVs) from reaching
this PC. As Administrator, run once:

```powershell
New-NetFirewallRule -DisplayName "EastEnd TV Signage" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### 6. Find the PC's local IP address

```powershell
ipconfig
```

Look for the "IPv4 Address" under the active network adapter (e.g.
`192.168.1.50`). This is what the TVs will use.

### 7. Point each TV at its screen

On each TV's browser, open:

```
http://<PC-IP>:3000/dis/<screenId>
```

e.g. `http://192.168.1.50:3000/dis/1`. Set it as the browser's home page /
startup page, and disable sleep/screensaver in the TV's settings. Manage
which images each screen shows from `http://<PC-IP>:3000/admin` (or
`http://localhost:3000/admin` from the PC itself).

### 8. (Optional) Canva sync and GitHub backups

Both are off by default and don't block anything above. If you want them,
add the relevant variables from `.env.example` to `.env.local` (see the main
[README](../README.md#setting-up-canva-importsync) for the full setup
steps for each), then re-run `deploy\setup.bat` to rebuild and restart the
service.

## Keeping it running reliably

- In Windows power settings, disable sleep/hibernate for this PC — it needs
  to stay awake and connected to the network at all times.
- In the PC's BIOS/UEFI settings, look for "Restore on AC power loss" (or
  similarly named) and set it to power back on automatically, so the PC
  (and the auto-starting service) come back after a power outage without
  anyone touching it.
- Back up the `data/` and `public/uploads/` folders periodically — that's
  the entire content library and screen configuration; there's no cloud
  copy anymore.

## Updating the app later

Copy the new code into the folder, then either double-click
`deploy\setup.bat` again, or manually:

```powershell
npm install
npm run build
Restart-Service EastEndTVSignage
```
