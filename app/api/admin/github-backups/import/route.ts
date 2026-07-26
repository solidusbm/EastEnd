import { NextResponse } from "next/server";
import { downloadGithubBackup, isGithubBackupConfigured } from "@/lib/githubBackup";
import { restoreUpload } from "@/lib/uploads";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
import { IMAGE_TYPES, type ImageRecord, type ImageType, type SavedPlaylist } from "@/lib/types";

interface RequestedItem {
  type: ImageType;
  filename: string;
}

interface RequestedPlaylist {
  id: string;
  name: string;
  imageFilenames: string[];
  imageDurationOverrides: Record<string, number>;
}

/** Turns "<uuid>-canva-1700000000000.png" or "<uuid>-my_menu_photo.jpg" into a readable label. */
function labelFromFilename(filename: string): string {
  const withoutId = filename.length > 37 && filename[36] === "-" ? filename.slice(37) : filename;
  return withoutId
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
}

export async function POST(request: Request) {
  if (!(await isGithubBackupConfigured())) {
    return NextResponse.json({ error: "GitHub backup isn't configured." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items: RequestedItem[] = rawItems.filter(
    (item): item is RequestedItem =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as RequestedItem).filename === "string" &&
      IMAGE_TYPES.includes((item as RequestedItem).type)
  );
  const rawPlaylists = Array.isArray(body.playlists) ? body.playlists : [];
  const requestedPlaylists: RequestedPlaylist[] = rawPlaylists.filter(
    (p): p is RequestedPlaylist =>
      typeof p === "object" &&
      p !== null &&
      typeof (p as RequestedPlaylist).id === "string" &&
      typeof (p as RequestedPlaylist).name === "string" &&
      Array.isArray((p as RequestedPlaylist).imageFilenames)
  );
  if (items.length === 0 && requestedPlaylists.length === 0) {
    return NextResponse.json({ error: "No valid items to import." }, { status: 400 });
  }

  // Downloading happens outside the store lock (it's slow, one GitHub
  // request per file) -- only the final write below needs to be atomic
  // relative to other requests. A filename collision with something saved
  // in the meantime is astronomically unlikely (filenames are UUID-prefixed).
  const initialStore = await readStore();
  const localFilenames = new Set(initialStore.images.map((img) => img.url.split("/").pop()));
  // Tracks filename -> id for every image that will exist locally once this
  // import finishes, so playlists (imported in the same request) can
  // resolve their filename references even to images that are only being
  // created right now.
  const idByFilename = new Map<string, string>();
  for (const img of initialStore.images) {
    const filename = img.url.split("/").pop();
    if (filename) idByFilename.set(filename, img.id);
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  const newImages: ImageRecord[] = [];

  for (const item of items) {
    if (localFilenames.has(item.filename)) {
      skipped++;
      continue;
    }
    try {
      const content = await downloadGithubBackup(item.type, item.filename);
      const url = await restoreUpload(item.filename, content);
      const image: ImageRecord = {
        id: crypto.randomUUID(),
        url,
        type: item.type,
        label: labelFromFilename(item.filename),
        uploadedAt: new Date().toISOString(),
      };
      newImages.push(image);
      localFilenames.add(item.filename);
      idByFilename.set(item.filename, image.id);
      imported++;
    } catch (err) {
      console.error(`[github-backups] Failed to import ${item.type}/${item.filename}:`, err);
      errors.push(item.filename);
    }
  }

  const localPlaylistIds = new Set(initialStore.savedPlaylists.map((p) => p.id));
  let playlistsImported = 0;
  let playlistsSkipped = 0;
  const newPlaylists: SavedPlaylist[] = [];

  for (const requested of requestedPlaylists) {
    if (localPlaylistIds.has(requested.id)) {
      playlistsSkipped++;
      continue;
    }
    const imageIds = requested.imageFilenames
      .map((f) => idByFilename.get(f))
      .filter((id): id is string => Boolean(id));
    const imageDurationOverrides: Record<string, number> = {};
    for (const [filename, seconds] of Object.entries(requested.imageDurationOverrides ?? {})) {
      const id = idByFilename.get(filename);
      if (id) imageDurationOverrides[id] = seconds;
    }
    newPlaylists.push({ id: requested.id, name: requested.name, imageIds, imageDurationOverrides });
    localPlaylistIds.add(requested.id);
    playlistsImported++;
  }

  if (newImages.length > 0 || newPlaylists.length > 0) {
    await withStoreLock(async () => {
      const store = await readStore();
      store.images.push(...newImages);
      store.savedPlaylists.push(...newPlaylists);
      await writeStore(store);
    });
  }

  return NextResponse.json({
    imported,
    skipped,
    failed: errors.length,
    errors,
    images: newImages,
    playlistsImported,
    playlistsSkipped,
    playlists: newPlaylists,
  });
}
