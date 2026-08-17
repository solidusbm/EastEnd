# East End Pizza — TV signage app (CLAUDE.md)

Next.js app driving restaurant TV menu-board displays (rotating menu/food/location/promo
photos/GIFs/videos). Storage is local disk (`data/config.json` + `public/uploads/`, both
gitignored) rather than a database, so this needs a host with a persistent, writable
filesystem — no serverless/Vercel.

**Hosted, containerized, and that is the only shape.** Deployed at
`https://lookatdis.sastx.net` (Coolify on the SaStx VPS, see
`C:\Users\solid\SaStx-VPS\CLAUDE.md`), with `data/` and `public/uploads/` as Coolify Volume
Mounts so they survive redeploys. TVs point at that public URL.

The app was originally built to run on a Windows PC at the restaurant with TVs pointed at its
LAN IP, and for a while both shapes were supported. **That local install was retired
2026-08-16** and its scaffolding deleted: the `deploy/` directory (Windows service installer,
`node-windows`, firewall/LAN setup), the `server-info` and `uploads-folder` API routes, the
`OpenUploadsFolder` admin component, and the "Server address" card in `SetupPanel`. Don't
reintroduce LAN-IP discovery, `explorer.exe` shell-outs, or a configurable server port —
the port is the container's. `lib/settings.ts` still carries a now-unused `serverPort` field
(left deliberately, it's harmless dead config). Working copy: `C:\Users\solid\EastEnd`
(directory name unchanged; the app itself is branded **lookatDis**).
Repo: `solidusbm/lookatDis` (renamed 2026-08-07, was `solidusbm/EastEnd`; GitHub redirects the
old URL), actively worked on branch `claude/restaurant-tv-signage-app-w8rtr4` (not main).

**SEPARATE codebase** from the East End Pizza customer-facing website (`C:\Users\solid\east-end-pizza`)
and the hosted reservations/admin app (`C:\Users\solid\east-end-pizza-hosted`, repo now
renamed `eepc`, live at `https://eastend.sastx.net`). Same restaurant, three repos.

## Data model
`data/config.json` holds `images` (id, url, type: menu/food/location/promo, label,
uploadedAt — video/GIF vs. static image is derived from the URL's extension via
`lib/media.ts`, not a stored field) and `screens` (id, name, imageIdsByType,
durationSecondsByType, perImageDurationSeconds, imageDurationOverrides, timingMode,
playlist, pip, scroll, keepAwake, orientation, scheduleRules, lastSeenAt). Images live in `public/uploads/`. All read/write
goes through `lib/store.ts` (`readStore`/`writeStore`/`withStoreLock` — every mutation is a
locked read-modify-write). `data/settings.json` holds the admin password hash and
GitHub/Canva credentials — see `lib/settings.ts` / `lib/auth.ts`.

### Scroll mode
`screen.scroll` (see `ScrollConfig` in `lib/types.ts`) swaps the one-at-a-time crossfade for
one continuous strip of every image, travelling in one of four directions at a configurable
px/second. It's presentation only — which images and in what order still comes from
`timingMode`/`playlist`/`imageIdsByType`, and an active schedule rule still takes over — so
per-image durations are ignored while it's on.

The no-black-bars property is structural, not a fit setting: each tile is pinned to the full
cross-axis (`h-full w-auto` scrolling horizontally, `w-full h-auto` vertically) and takes
whatever length its own aspect ratio implies, and the list repeats enough times to cover the
screen. **Don't "fix" a tile by pinning both dimensions or adding `object-cover`** — that's
exactly what reintroduces bars or crops. `shrink-0` on the tiles is load-bearing too: without
it flexbox squashes every image. Seamlessness comes from translating within `[-unitLength, 0]`
where `unitLength` is one copy of the list, measured with a ResizeObserver because images only
reach their real size as they decode. Note that a hidden/backgrounded browser tab pauses
`requestAnimationFrame` entirely, so the strip legitimately freezes when not visible — that's
the browser, not a bug (irrelevant on a TV, but it will bite you when testing).

### Orientation
`screen.orientation` (0/90/180/270, default 0) rotates everything the display draws, for TVs
mounted sideways — the stick still sends an ordinary landscape signal, so the panel being
turned is invisible to it and the rotation has to happen in CSS.

`DisplayFrame` in `DisplayClient.tsx` is the single `position: fixed` element and carries the
transform; every display state renders inside it, so the "no images yet" placeholder and the
emergency override come out the right way up too. For the quarter turns the box is built at the
swapped size (100vh x 100vw) and rotated back over the viewport — the paired `translate` is
what returns it on-screen, since rotating about the top-left corner alone swings it entirely
outside. Everything inside positions with `absolute`, deliberately: a transformed ancestor is
the containing block for `fixed` descendants anyway, so `fixed` in there would not mean what
it looks like it means.

Watch for code that reads `window.innerWidth/innerHeight` to mean "how big is the display" —
under 90/270 those are the wrong way round. `ScrollingStrip` measures its own container
instead, which is why scroll mode still tiles correctly in portrait. Verified at all four
orientations: the frame's post-transform box covers the viewport exactly, and 270 + horizontal
scroll keeps full-cross-axis tiles with zero gaps.

### Keep awake
`screen.keepAwake` (see `app/dis/[screenId]/useKeepAwake.ts`) stops the TV blanking or
screensaving while a display page is open. **Defaults to ON**, unlike `pip`/`scroll` — a menu
board that blanks itself has failed at its only job, so `normalizeKeepAwake` treats
absent/invalid as true and only an explicit `false` turns it off.

Two mechanisms, in order: the Screen Wake Lock API, then a 2x2px silent looping
`public/keep-awake.mp4` (~1.8 KB, ffmpeg-generated, H.264 baseline) for TV browsers that lack
the API or refuse the lock. The video runs **only** as a fallback — cheap TV hardware has very
few video decoders and permanently burning one could starve the rotation's own MP4/GIF
playback. Note the platform releases a screen wake lock every time the page is hidden and never
restores it, so re-acquiring on `visibilitychange` is required, not defensive padding.

Be honest with the user about the ceiling: **a web page cannot always beat an OS sleep timer.**
This suppresses the screensaver in most cases, but a Fire TV stick set to power the display
down on a timer needs its own setting changed (Settings → Display & Sounds → Screensaver →
Start Delay → Never). Don't promise more than that.

## Integrations
- **Canva sync** (`lib/canvaSync.ts`) — polls every 5 min for changed linked designs, re-exports.
- **GitHub image backup** (`lib/githubBackup.ts`) — every saved image copied to a GitHub repo/branch
  (user-configured in Setup). Compares by git blob hash before re-uploading. Manual "Back up
  now" button at `/api/admin/github-backups/run`.
  **⚠️ Known issue (unresolved as of 2026-07-25):** was failing with `Error: Creating backup
  branch failed (403)` — likely an expired/permission-losing PAT. Not yet re-verified since.
- **Signage sync** (`lib/signageSync.ts`) — polls the `eepc` app (`SIGNAGE_SYNC_URL`, defaults
  to `https://eastend.sastx.net`) every 2 min, mirrors screens 1:1 and downloads new/changed
  images. One-way (hosted admin → this app only); this app's own `/admin` edits do NOT sync
  back up. Records from remote sync tagged `signageSyncedAt`; local-only records are never
  touched/deleted by cleanup.

## Auth
Admin password is a salted scrypt hash in `data/settings.json` (`adminPasswordHash`), set via
the first-run `/admin/setup` wizard; the `ADMIN_PASSWORD` env var is a legacy fallback only
used if no hash exists yet. `hasAdminPassword()` false → every `/admin*` request redirects to
`/admin/setup`. To force a password reset, delete `adminPasswordHash` from
`data/settings.json` (leave everything else in that file alone) and revisit `/admin`. See
`lib/auth.ts`, `proxy.ts`.

## Public routes (no auth)
`/dis/[screenId]` (the TV view), `/dis` (screen picker), and `/api/display/*` are
intentionally outside `proxy.ts`'s auth matcher (`/admin/:path*`, `/api/admin/:path*` only) —
anyone with the URL can view a screen or the picker, by design (that's the whole point, TVs
are unauthenticated clients).

## Build / run notes
- `NewScreenForm.tsx` only asks for the Display name; `POST /api/admin/screens` derives the
  slug server-side via `slugify()` + collision-avoidance (`-2`, `-3`).
- **Push-to-deploy is fragile here — verify, never assume a push went live.** Coolify matches
  an incoming GitHub webhook against the application's configured `git_repository` string. The
  repo was renamed `solidusbm/EastEnd` → `solidusbm/lookatDis` on 2026-08-07 but Coolify's app
  record was not updated, so from that day every webhook was acknowledged with a 200 and then
  matched nothing: no deploy was queued, not even a failed one, and two commits sat unshipped
  for nine days before anyone noticed (found 2026-08-16). Confirm a deploy actually landed by
  checking a route that only the new build serves, or read the running image tag — it is the
  built commit SHA:
  `ssh -i C:\Users\solid\sastx root@66.179.136.253 "docker ps --format '{{.Image}}' | grep <app-hash>"`.
  Separately, Cloudflare Access covers `coolify.sastx.net/webhooks/*` and needs a Bypass rule
  or GitHub's POST just gets a login page — that was fixed for `wwrvb` on 2026-08-10.

## Cross-agent
Read by both Claude Code (alongside AGENTS.md) and Hermes. Portfolio rules: `~/.claude/CLAUDE.md`.
