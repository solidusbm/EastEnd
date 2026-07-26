import { readStore, withStoreLock, writeStore } from "./store";
import { deleteUpload, saveUpload } from "./uploads";
import { defaultPipConfig, type ImageRecord, type ImageType, type Screen } from "./types";

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const INITIAL_DELAY_MS = 10_000;

// The hosted admin panel (Render) this app pulls screens/images from --
// screens and images are managed there (see east-end-pizza-hosted's
// "Signage" admin tab), but the TVs still load from this local app, so this
// poller mirrors that remote state into the local store + local image files.
const REMOTE_BASE = process.env.SIGNAGE_SYNC_URL || "https://east-end-pizza-hosted.onrender.com";

let pollTimer: ReturnType<typeof setInterval> | null = null;

interface RemoteImage {
  id: string;
  type: ImageType;
  label: string;
  content_type: string;
  uploaded_at: string;
}

interface RemoteScreen {
  id: string;
  name: string;
  image_ids_by_type: Record<ImageType, string[]>;
  duration_seconds_by_type: Record<ImageType, number>;
  per_image_duration_seconds: number;
  updated_at: string;
}

function extFromContentType(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "jpg";
}

async function syncOnce(): Promise<void> {
  let snapshot: { screens: RemoteScreen[]; images: RemoteImage[] };
  try {
    const res = await fetch(`${REMOTE_BASE}/api/signage/sync`, { cache: "no-store" });
    if (!res.ok) throw new Error(`sync fetch failed (${res.status})`);
    snapshot = await res.json();
  } catch (err) {
    console.error("[signage-sync] Failed to fetch remote snapshot:", err);
    return;
  }

  const store = await readStore();
  const localImagesById = new Map(store.images.map((img) => [img.id, img]));
  const remoteImageIds = new Set(snapshot.images.map((img) => img.id));

  // Download only new/changed images (compare against the remote's own
  // uploaded_at, stamped locally as signageSyncedAt) -- avoids re-fetching
  // every image's bytes on every poll.
  const downloaded: ImageRecord[] = [];
  for (const remoteImg of snapshot.images) {
    const local = localImagesById.get(remoteImg.id);
    if (local?.signageSyncedAt === remoteImg.uploaded_at) continue;

    try {
      const res = await fetch(`${REMOTE_BASE}/api/signage/images/${remoteImg.id}`);
      if (!res.ok) throw new Error(`image fetch failed (${res.status})`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = `${remoteImg.id}-signage.${extFromContentType(remoteImg.content_type)}`;
      const url = await saveUpload(remoteImg.type, filename, buffer);
      downloaded.push({
        id: remoteImg.id,
        url,
        type: remoteImg.type,
        label: remoteImg.label,
        uploadedAt: remoteImg.uploaded_at,
        signageSyncedAt: remoteImg.uploaded_at,
      });
    } catch (err) {
      console.error(`[signage-sync] Failed to download image ${remoteImg.id}:`, err);
    }
  }

  const remoteScreens: Screen[] = snapshot.screens.map((s) => ({
    id: s.id,
    name: s.name,
    imageIdsByType: s.image_ids_by_type,
    durationSecondsByType: s.duration_seconds_by_type,
    perImageDurationSeconds: s.per_image_duration_seconds,
    imageDurationOverrides: {},
    // The hosted admin panel doesn't have fine-grain playlist mode -- synced
    // screens always come in as plain category timing.
    timingMode: "category",
    playlist: [],
    pip: defaultPipConfig(),
    scheduleRules: [],
    signageSyncedAt: s.updated_at,
  }));

  await withStoreLock(async () => {
    const fresh = await readStore();

    const localOnlyImages = fresh.images.filter((img) => !img.signageSyncedAt);
    const stillRemoteImages = fresh.images.filter(
      (img) => img.signageSyncedAt && remoteImageIds.has(img.id) && !downloaded.some((d) => d.id === img.id)
    );
    const removedRemoteImages = fresh.images.filter((img) => img.signageSyncedAt && !remoteImageIds.has(img.id));
    fresh.images = [...localOnlyImages, ...stillRemoteImages, ...downloaded];

    const localOnlyScreens = fresh.screens.filter((s) => !s.signageSyncedAt);
    fresh.screens = [...localOnlyScreens, ...remoteScreens];

    await writeStore(fresh);

    for (const removed of removedRemoteImages) {
      await deleteUpload(removed.url);
    }
  });

  if (downloaded.length > 0) {
    console.log(`[signage-sync] Downloaded ${downloaded.length} image(s), synced ${remoteScreens.length} screen(s)`);
  }
}

/** Starts the periodic sync from the hosted admin panel. Idempotent. */
export function startSignageSyncPoller(): void {
  if (pollTimer) return;

  setTimeout(() => {
    syncOnce().catch((err) => console.error("[signage-sync] Initial sync failed:", err));
  }, INITIAL_DELAY_MS);

  pollTimer = setInterval(() => {
    syncOnce().catch((err) => console.error("[signage-sync] Sync cycle failed:", err));
  }, POLL_INTERVAL_MS);
}
