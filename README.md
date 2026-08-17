# EastEnd TV Signage

A small Next.js app that displays pre-made menu board images and food photos on
restaurant TVs. Staff upload images, tag them into a category (menu, food,
location, or promo), and assign them to screens from a password-protected
admin page. Each screen picks its images per category via a popup picker and
has its own per-category display duration; each TV points its browser at
`/dis/[screenId]` and cycles through the categories (skipping any with no
images or a zero-second duration) on a timer, polling for content updates
automatically.

## How it works

- **Storage**: images live in `public/uploads/` and the small JSON config
  (screens + image metadata) lives in `data/config.json`, both on disk on
  whatever machine hosts the app — no cloud dependency, no database. This is
  enough at this scale (one location, a handful of screens). It needs a host
  that gives the app a persistent, writable filesystem — a container with
  mounted volumes — and that host reachable, same as any other web app.
  Neither directory is
  committed to git (see `.gitignore`); back them up directly on whatever
  machine hosts the app.
- **Auth**: `/admin` and the `/api/admin/*` mutation routes are protected by a
  single shared password via an HMAC-signed cookie set in `proxy.ts`. There
  are no user accounts. The password is either the `ADMIN_PASSWORD` env var
  (legacy/`.env.local`-based setups) or a salted hash in
  `data/settings.json` (anything set through the browser) — the latter takes
  priority once it exists. If neither is set yet, every `/admin*` request is
  redirected to `/admin/setup` to create the first account; from then on,
  Setup > **Admin password** changes it (and immediately invalidates every
  other signed-in session, including any left open elsewhere). See
  `lib/auth.ts`.
- **Display**: `/dis/[screenId]` is a full-screen client view with no
  chrome. It polls `/api/display/[screenId]` every 45 seconds and picks up
  content/duration changes without a manual reload, crossfading between images
  as it cycles.
- **GitHub backup** (optional): every uploaded/synced image is also pushed to
  a branch in a GitHub repo via the REST Contents API — a permanent archive
  that deleting the image in the app never touches. Disabled until a token +
  repo are set, either from the **Setup** section in `/admin` or via
  `GITHUB_BACKUP_TOKEN`/`GITHUB_BACKUP_REPO` in `.env.local`. See
  `lib/githubBackup.ts`.
- **Canva sync** (optional): images can be imported from a Canva design URL
  instead of a file upload. A background poller (`lib/canvaSync.ts`, started
  once per server via `instrumentation.ts`) checks every 5 minutes whether a
  linked design has changed and re-exports it automatically — Canva has no
  "design changed" webhook, so polling is the only option. Disabled until a
  Client ID/Secret/Redirect URI are set (Setup section in `/admin`, or
  `CANVA_CLIENT_ID`/`CANVA_CLIENT_SECRET`/`CANVA_REDIRECT_URI`); even then,
  each install needs a one-time "Connect Canva account" step from `/admin`.
  See `lib/canva.ts`.
- **Setup panel**: `/admin` has a collapsed-by-default "Setup" section for
  entering the GitHub backup and Canva credentials from the browser —
  persisted to `data/settings.json`, no `.env.local` editing or restart
  needed. Env vars still work as a fallback for anything left unset there.
  It also sets the caption label style and lets you change the admin
  password.

## Environment variables

None of these are required to get started — with nothing set, the first
visit to `/admin` walks you through creating the admin account in the
browser. `.env.local` (copy it from `.env.example`) is only needed if you'd
rather set things that way instead of through the browser (Setup section in
`/admin`, or the `/admin/setup` first-run page for the password) — whichever
you use, they're equivalent.

| Variable | Description |
| --- | --- |
| `ADMIN_PASSWORD` | Shared password for `/admin`. Only read if no password has been set via `/admin/setup` or Setup's "Admin password" yet. |
| `GITHUB_BACKUP_TOKEN` | Optional. Fine-grained GitHub PAT with Contents: Read and write on the target repo. Leave blank to disable image backups. |
| `GITHUB_BACKUP_REPO` | Optional. `owner/repo` to back images up to. |
| `GITHUB_BACKUP_BRANCH` | Optional. Branch to push backups to (default `image-backups`). |
| `CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET` | Optional. From a Canva integration registered at [canva.com/developers](https://www.canva.com/developers). Leave blank to disable Canva import/sync. |
| `CANVA_REDIRECT_URI` | Optional. Must exactly match the redirect URL configured on the Canva integration, e.g. `http://localhost:3000/api/admin/canva/callback`. |

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin) — since
there's no password configured yet, you'll land on `/admin/setup` to create
one. After that, upload a few images and create a screen, then open
`/dis/<screenId>` in another tab to see it cycle.

## Setting up Canva import/sync

The **Setup** section in `/admin` (collapsed by default, near the bottom)
walks through this with the same steps inline — the version here is just for
reference or for setting it via `.env.local` instead.

1. Go to [canva.com/developers](https://www.canva.com/developers), create an
   integration, and note its **Client ID** and **Client Secret**.
2. Add scopes `design:meta:read` and `design:content:read` to the
   integration.
3. In the integration's settings, add a redirect URL that exactly matches
   the one you'll use as `CANVA_REDIRECT_URI` (or the "Redirect URI" field in
   Setup) — for local dev, `http://localhost:3000/api/admin/canva/callback`;
   for a deployed install, swap in whatever public URL is actually used to
   reach `/admin` day to day.
4. Either paste the Client ID/Secret/Redirect URI into the Setup section in
   `/admin` and click Save, or set `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`,
   and `CANVA_REDIRECT_URI` in `.env.local` and restart the app.
5. In `/admin`, click **Connect Canva account** and approve the
   authorization. From then on, "Import from Canva" is available in the
   upload form, and linked images auto-refresh in the background.

## Setting up GitHub image backups

Same as above — the **Setup** section in `/admin` covers this inline; this is
the `.env.local` equivalent.

1. Create a GitHub [fine-grained personal access
   token](https://github.com/settings/personal-access-tokens/new) scoped to
   the target repo with **Contents: Read and write** permission.
2. Either paste the token and repo (`owner/repo`) into the Setup section in
   `/admin`, click "Test connection" to confirm access, then Save — or set
   `GITHUB_BACKUP_TOKEN` and `GITHUB_BACKUP_REPO` in `.env.local` and restart
   the app. Backups land in a branch named `image-backups` by default
   (override with `GITHUB_BACKUP_BRANCH`), created automatically on first use.

## Deploying

Since storage is local disk rather than a cloud service, this app needs a
host with a persistent, writable filesystem — that rules out purely
stateless/serverless hosting (Vercel and similar, which have a read-only,
ephemeral filesystem).

Deploy it as **a container with persistent volumes** — `data/` and
`public/uploads/` mounted so they survive redeploys — and point the TVs at
whatever public URL that host serves. It currently runs on Coolify at
`https://lookatdis.sastx.net`.

> Running it on a Windows PC at the venue, with the TVs pointed at that PC's
> LAN IP, used to be supported as well; that was retired on 2026-08-16 and
> the installer, Windows-service scripts and LAN-address UI were removed.

On the TV itself: set the display URL as the browser's home page
/ bookmark and disable sleep/screensaver in the TV's settings. Older
WebOS/Tizen browsers have limited CSS/JS support, so test on the actual TV
early rather than assuming desktop Chrome behavior carries over.

## Data model

- **Image**: `id`, `url`, `type` (`"menu" | "food" | "location" | "promo"`),
  `label` (optional, admin-only), `uploadedAt`, plus optional
  `canvaDesignId`/`canvaSyncedAt` if imported from Canva.
- **Screen**: `id`, `name`, `imageIdsByType` (image ids per category),
  `durationSecondsByType` (how long each category is shown per cycle, per
  category), `perImageDurationSeconds` (how long each individual image is
  shown before advancing to the next one in the same category).

Screens saved by an older version of this app (with `menuImageIds` /
`foodImageIds` / `menuDurationSeconds` / `foodDurationSeconds`) are migrated
to the current shape automatically the next time they're read — no manual
migration needed.

## Project structure

- `app/admin/` — password-protected dashboard.
  - `AdminDashboard.tsx` — top-level layout: Screens, Upload, Image library,
    Setup, in that order.
  - `setup/` — `/admin/setup`, the first-run "create the admin account" page
    (redirects to `/admin/login` once an account already exists).
  - `login/` — the normal `/admin/login` page.
  - `ScreenCard.tsx` / `NewScreenForm.tsx` — create/edit/delete screens.
  - `ImagePickerModal.tsx` — popup for assigning a screen's images per
    category.
  - `UploadForm.tsx` — file upload or "Import from Canva".
  - `ImageLibrary.tsx` — browse/edit/delete/replace uploaded images.
  - `SetupPanel.tsx` — admin password change, GitHub backup and Canva
    credential forms, and connect/disconnect.
- `app/dis/[screenId]/` — full-screen TV view.
- `app/api/admin/` — authenticated CRUD for images, screens, and settings;
  `setup` (first-run account creation) and `change-password` are the two
  exceptions with their own rules (see `lib/auth.ts`); Canva has its own
  `canva/connect|callback|status|disconnect|import|resync`.
- `app/api/display/[screenId]/` — public, read-only endpoint the TV polls.
- `lib/types.ts` — shared types, the `IMAGE_TYPES` category list, and
  per-category normalization helpers.
- `lib/store.ts` — reads/writes `data/config.json` on local disk (includes
  the legacy-screen migration).
- `lib/uploads.ts` — saves/deletes uploaded image files in `public/uploads/`
  (and fires off the GitHub backup on every save).
- `lib/settings.ts` — reads/writes `data/settings.json`: the admin password
  hash and the GitHub/Canva credentials entered via the Setup panel.
- `lib/githubBackup.ts` — permanent image backups via the GitHub Contents API.
- `lib/canva.ts` / `lib/canvaTokens.ts` / `lib/canvaSync.ts` — Canva Connect
  API client (OAuth, design export), local token storage, and the background
  sync poller.
- `instrumentation.ts` — starts the Canva sync poller once per server start.
- `lib/auth.ts` / `proxy.ts` — password hashing/verification, session
  cookies, and route protection (including the redirect-to-setup logic when
  no account exists yet).
