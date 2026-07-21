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

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
| --- | --- |
| `ADMIN_PASSWORD` | Shared password for `/admin`. |

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin), log in with
`ADMIN_PASSWORD`, upload a few images, and create a screen. Then open
`/dis/<screenId>` in another tab to see it cycle.

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
  `label` (optional, admin-only), `uploadedAt`.
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
- `lib/uploads.ts` — saves/deletes uploaded image files in `public/uploads/`.
- `lib/auth.ts` / `proxy.ts` — shared-password session cookie and route
  protection.
- `deploy/` — Windows Service install/uninstall scripts and the restaurant
  PC setup guide.
