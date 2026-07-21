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
  (screens + image metadata) lives in `data/config.json`, both on local disk
  — no cloud dependency, no database. This is enough at this scale (one
  location, a handful of screens) and means the app runs fully offline.
  Neither directory is committed to git (see `.gitignore`); back them up
  directly on whatever machine hosts the app.
- **Auth**: `/admin` and the `/api/admin/*` mutation routes are protected by a
  single shared password (`ADMIN_PASSWORD`) via an HMAC-signed cookie set in
  `middleware.ts`/`proxy.ts`. There are no user accounts.
- **Display**: `/dis/[screenId]` is a full-screen client view with no
  chrome. It polls `/api/display/[screenId]` every 45 seconds and picks up
  content/duration changes without a manual reload, crossfading between images
  as it cycles.
- **GitHub backup** (optional): every uploaded/synced image is also pushed to
  a branch in a GitHub repo via the REST Contents API — a permanent archive
  that deleting the image in the app never touches. Disabled unless
  `GITHUB_BACKUP_TOKEN` is set. See `lib/githubBackup.ts`.
- **Canva sync** (optional): images can be imported from a Canva design URL
  instead of a file upload. A background poller (`lib/canvaSync.ts`, started
  once per server via `instrumentation.ts`) checks every 5 minutes whether a
  linked design has changed and re-exports it automatically — Canva has no
  "design changed" webhook, so polling is the only option. Disabled unless
  `CANVA_CLIENT_ID`/`CANVA_CLIENT_SECRET`/`CANVA_REDIRECT_URI` are set; even
  then, each install needs a one-time "Connect Canva account" step from
  `/admin`. See `lib/canva.ts`.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
| --- | --- |
| `ADMIN_PASSWORD` | Shared password for `/admin`. |
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

Open [http://localhost:3000/admin](http://localhost:3000/admin), log in with
`ADMIN_PASSWORD`, upload a few images, and create a screen. Then open
`/dis/<screenId>` in another tab to see it cycle.

## Setting up Canva import/sync

1. Go to [canva.com/developers](https://www.canva.com/developers), create an
   integration, and note its **Client ID** and **Client Secret**.
2. In the integration's settings, add a redirect URL that exactly matches
   what you'll set as `CANVA_REDIRECT_URI` — for local dev,
   `http://localhost:3000/api/admin/canva/callback`; for the restaurant PC,
   swap in whatever URL staff actually use to reach `/admin` (its LAN IP or
   `localhost` if only used on that PC).
3. Add scopes `design:meta:read` and `design:content:read` to the
   integration.
4. Set `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, and `CANVA_REDIRECT_URI` in
   `.env.local`, then restart the app.
5. In `/admin`, click **Connect Canva account** in the new Canva panel and
   approve the authorization. From then on, "Import from Canva" is available
   in the upload form, and linked images auto-refresh in the background.

## Setting up GitHub image backups

1. Create a GitHub [fine-grained personal access
   token](https://github.com/settings/personal-access-tokens/new) scoped to
   the target repo with **Contents: Read and write** permission.
2. Set `GITHUB_BACKUP_TOKEN` and `GITHUB_BACKUP_REPO` (`owner/repo`) in
   `.env.local`, then restart the app. Backups land in a branch named
   `image-backups` by default (override with `GITHUB_BACKUP_BRANCH`), which
   is created automatically on first use.

## Deploying to a restaurant PC

Since storage is local disk rather than a cloud service, this app is meant
to run on a dedicated PC on-site (not on Vercel/serverless hosting, which
has a read-only, ephemeral filesystem). Copy the project onto the PC and
double-click `deploy/setup.bat` — it installs Node if needed, builds for
production, registers an auto-starting/auto-restarting Windows Service, and
opens the firewall for the TVs. See [`deploy/README.md`](deploy/README.md)
for the full walkthrough (including doing each step manually).

On the TV itself: set the display URL as the browser's home page / bookmark
and disable sleep/screensaver in the TV's settings. Older WebOS/Tizen browsers
have limited CSS/JS support, so test on the actual TV early rather than
assuming desktop Chrome behavior carries over.

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

- `app/admin/` — password-protected dashboard (upload/tag/delete images,
  create/edit/delete screens). `ImagePickerModal.tsx` is the popup used to
  assign a screen's images per category.
- `app/dis/[screenId]/` — full-screen TV view.
- `app/api/admin/` — authenticated CRUD for images and screens.
- `app/api/display/[screenId]/` — public, read-only endpoint the TV polls.
- `lib/types.ts` — shared types, the `IMAGE_TYPES` category list, and
  per-category normalization helpers.
- `lib/store.ts` — reads/writes `data/config.json` on local disk (includes
  the legacy-screen migration).
- `lib/uploads.ts` — saves/deletes uploaded image files in `public/uploads/`
  (and fires off the GitHub backup on every save).
- `lib/githubBackup.ts` — permanent image backups via the GitHub Contents API.
- `lib/canva.ts` / `lib/canvaTokens.ts` / `lib/canvaSync.ts` — Canva Connect
  API client (OAuth, design export), local token storage, and the background
  sync poller. `app/api/admin/canva/` has the connect/callback/import/resync
  routes; `app/admin/CanvaPanel.tsx` is the connection-status UI.
- `lib/auth.ts` / `proxy.ts` — shared-password session cookie and route
  protection.
- `deploy/` — Windows Service install/uninstall scripts and the restaurant
  PC setup guide.
