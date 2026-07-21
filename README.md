# EastEnd TV Signage

A small Next.js app that displays pre-made menu board images and food photos on
restaurant TVs. Staff upload images and assign them to screens from a
password-protected admin page; each TV points its browser at
`/display/[screenId]` and cycles between "menu mode" and "food photo mode" on a
timer, polling for content updates automatically.

## How it works

- **Storage**: images and the small JSON config (screens + image metadata) are
  both stored in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob).
  There is no separate database — `config.json` is a single blob that holds
  the whole `{ images, screens }` record, which is enough at this scale (one
  location, a handful of screens).
- **Auth**: `/admin` and the `/api/admin/*` mutation routes are protected by a
  single shared password (`ADMIN_PASSWORD`) via an HMAC-signed cookie set in
  `middleware.ts`/`proxy.ts`. There are no user accounts.
- **Display**: `/display/[screenId]` is a full-screen client view with no
  chrome. It polls `/api/display/[screenId]` every 45 seconds and picks up
  content/duration changes without a manual reload, crossfading between images
  as it cycles.

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
| --- | --- |
| `ADMIN_PASSWORD` | Shared password for `/admin`. |
| `BLOB_READ_WRITE_TOKEN` | Token for your Vercel Blob store. When deployed on Vercel with a Blob store connected to the project, this is injected automatically — you only need to set it manually for local development (`vercel env pull` or copy it from the Vercel dashboard). |

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin), log in with
`ADMIN_PASSWORD`, upload a few images, and create a screen. Then open
`/display/<screenId>` in another tab to see it cycle.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add a Blob store to the project (Storage tab → Create → Blob) — this sets
   `BLOB_READ_WRITE_TOKEN` for you automatically.
3. Set `ADMIN_PASSWORD` in the project's Environment Variables.
4. Deploy. Visit `/admin` to set up screens, then point each TV's browser at
   its `/display/[screenId]` URL (the admin page shows the direct link for
   each screen, with a copy button).

On the TV itself: set the display URL as the browser's home page / bookmark
and disable sleep/screensaver in the TV's settings. Older WebOS/Tizen browsers
have limited CSS/JS support, so test on the actual TV early rather than
assuming desktop Chrome behavior carries over.

## Data model

- **Image**: `id`, `url`, `type` (`"menu" | "food"`), `label` (optional,
  admin-only), `uploadedAt`.
- **Screen**: `id`, `name`, `menuImageIds`, `foodImageIds`,
  `menuDurationSeconds`, `foodDurationSeconds`, `perImageDurationSeconds`.

## Project structure

- `app/admin/` — password-protected dashboard (upload/tag/delete images,
  create/edit/delete screens).
- `app/display/[screenId]/` — full-screen TV view.
- `app/api/admin/` — authenticated CRUD for images and screens.
- `app/api/display/[screenId]/` — public, read-only endpoint the TV polls.
- `lib/store.ts` — reads/writes `config.json` in Vercel Blob.
- `lib/auth.ts` / `proxy.ts` — shared-password session cookie and route
  protection.
