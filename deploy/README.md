# Deploying to the restaurant's Windows PC

This app now stores everything (config + uploaded images) on local disk
(`data/config.json` and `public/uploads/`), so it runs fully offline — no
Vercel account or internet connection needed once it's set up. These steps
turn a Windows PC into a dedicated, always-on signage server that TVs on the
restaurant's network point their browsers at.

## 1. Get Node.js onto the PC

Download and install the **LTS** version from https://nodejs.org (or, if
`winget` is available: `winget install OpenJS.NodeJS.LTS`). Restart the
terminal after installing so `node`/`npm` are on PATH.

## 2. Copy the app onto the PC

Copy this whole project folder onto the PC, e.g. to `C:\EastEndSignage`.
(Zip it up and copy via USB drive, or `git clone` the repo if the PC has git
and access to it.)

## 3. Install dependencies and configure the admin password

In a PowerShell window, `cd` into the folder, then:

```powershell
npm install
Copy-Item .env.example .env.local
notepad .env.local
```

Set `ADMIN_PASSWORD` to whatever password staff should use to log into
`/admin`. Save and close.

## 4. Bring over existing content (optional)

If you're migrating from an earlier Vercel-hosted version, copy its
`data/config.json` and the contents of `public/uploads/` into this folder's
`data/` and `public/uploads/` directories before starting the server. If
this is a fresh setup, skip this — the app starts with an empty library.

## 5. Build for production

```powershell
npm run build
```

Re-run this any time you change the app's code (not needed for day-to-day
image/screen edits through `/admin` — those just write to `data/` and
`public/uploads/` directly).

## 6. Install as an auto-starting Windows Service

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

## 7. Open the firewall for other devices on the network

By default Windows Firewall blocks other devices (the TVs) from reaching
this PC. As Administrator, run once:

```powershell
New-NetFirewallRule -DisplayName "EastEnd TV Signage" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

## 8. Find the PC's local IP address

```powershell
ipconfig
```

Look for the "IPv4 Address" under the active network adapter (e.g.
`192.168.1.50`). This is what the TVs will use.

## 9. Point each TV at its screen

On each TV's browser, open:

```
http://<PC-IP>:3000/dis/<screenId>
```

e.g. `http://192.168.1.50:3000/dis/1`. Set it as the browser's home page /
startup page, and disable sleep/screensaver in the TV's settings. Manage
which images each screen shows from `http://<PC-IP>:3000/admin` (or
`http://localhost:3000/admin` from the PC itself).

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

```powershell
# pull/copy the new code into the folder, then:
npm install
npm run build
# restart the service so it picks up the new build:
Restart-Service EastEndTVSignage
```
