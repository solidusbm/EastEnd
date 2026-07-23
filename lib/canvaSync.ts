import { readStore, withStoreLock, writeStore } from "./store";
import { deleteUpload, saveUpload } from "./uploads";
import { fetchCanvaImage, getDesignMetadata, getValidAccessToken } from "./canva";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 10_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;

interface SyncedImage {
  id: string;
  url: string;
  uploadedAt: string;
  canvaSyncedAt: string;
  previousUrl: string;
}

async function syncOnce(): Promise<void> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return; // Canva not connected -- nothing to do.

  const store = await readStore();
  const linkedImages = store.images.filter((img) => img.canvaDesignId);
  if (linkedImages.length === 0) return;

  // Fetching from Canva is slow (network calls per image) -- done here,
  // outside the store lock, so it doesn't block other requests (TV polls,
  // admin edits) for however long this takes. Only the final write below
  // needs the lock, against a freshly re-read store.
  const updates: SyncedImage[] = [];

  for (const image of linkedImages) {
    const designId = image.canvaDesignId;
    if (!designId) continue;
    try {
      // Cheap metadata check first -- only run the (rate-limited) export job
      // if the design has actually changed since we last synced it.
      const design = await getDesignMetadata(accessToken, designId);
      const designUpdatedAt = new Date(design.updatedAt * 1000).toISOString();
      if (image.canvaSyncedAt && designUpdatedAt <= image.canvaSyncedAt) {
        continue;
      }

      const fetched = await fetchCanvaImage(accessToken, designId);
      const url = await saveUpload(image.type, `${image.id}-canva-${Date.now()}.png`, fetched.buffer);
      updates.push({
        id: image.id,
        url,
        uploadedAt: new Date().toISOString(),
        canvaSyncedAt: fetched.designUpdatedAt,
        previousUrl: image.url,
      });
      console.log(`[canva-sync] Updated image ${image.id} from design ${designId}`);
    } catch (err) {
      console.error(`[canva-sync] Failed to sync image ${image.id} (design ${designId}):`, err);
    }
  }

  if (updates.length === 0) return;

  await withStoreLock(async () => {
    const freshStore = await readStore();
    for (const update of updates) {
      const freshImage = freshStore.images.find((img) => img.id === update.id);
      if (!freshImage) continue;
      freshImage.url = update.url;
      freshImage.uploadedAt = update.uploadedAt;
      freshImage.canvaSyncedAt = update.canvaSyncedAt;
    }
    await writeStore(freshStore);
  });

  for (const update of updates) {
    await deleteUpload(update.previousUrl);
  }
}

/** Starts the periodic background check for Canva-linked images. Idempotent. */
export function startCanvaSyncPoller(): void {
  if (pollTimer) return;

  setTimeout(() => {
    syncOnce().catch((err) => console.error("[canva-sync] Initial sync check failed:", err));
  }, INITIAL_DELAY_MS);

  pollTimer = setInterval(() => {
    syncOnce().catch((err) => console.error("[canva-sync] Sync cycle failed:", err));
  }, POLL_INTERVAL_MS);
}
