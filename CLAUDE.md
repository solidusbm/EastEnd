# East End Pizza — TV signage app (CLAUDE.md)

Next.js app driving restaurant TV menu-board displays (rotating menu/food/location/promo
photos/GIFs/videos). Storage is local disk (`data/config.json` + `public/uploads/`, both
gitignored) rather than a database, so this needs a host with a persistent, writable
filesystem — no serverless/Vercel. Two supported deployment shapes, not one:

- **Local PC install** — runs directly on a Windows PC on-site; TVs point at that PC's LAN
  IP. See `deploy/README.md`. This is the original design and still fully supported.
- **Hosted, containerized** — currently deployed at `https://lookatdis.sastx.net` (Coolify on
  the SaStx VPS, see `C:\Users\solid\SaStx-VPS\CLAUDE.md`), with `data/` and
  `public/uploads/` as Coolify Volume Mounts so they survive redeploys. TVs point at the
  public URL instead of a LAN IP.

Neither shape is "the real one" — don't write new code or docs that assume only one. Local:
`C:\Users\solid\EastEnd` (directory name unchanged; the app itself is branded **lookatDis**).
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
playlist, pip, scroll, scheduleRules, lastSeenAt). Images live in `public/uploads/`. All read/write
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
- Local install: rebuilding requires `npm run build` THEN restarting `npm run start` (runs in
  production mode, NOT `next dev`). Pushing to GitHub alone does NOT update a running local
  instance — this bit the user once ("new feature isn't showing up"). The hosted deployment
  redeploys itself from a push (Coolify watches the branch).

## Cross-agent
Read by both Claude Code (alongside AGENTS.md) and Hermes. Portfolio rules: `~/.claude/CLAUDE.md`.
