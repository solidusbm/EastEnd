import { readStore, writeStore } from "./store";
import { deleteUpload, saveUpload } from "./uploads";
import { fetchCanvaImage, getDesignMetadata, getValidAccessToken } from "./canva";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const INITIAL_DELAY_MS = 10_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function syncOnce(): Promise<void> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return; // Canva not connected -- nothing to do.

  const store = await readStore();
  const linkedImages = store.images.filter((img) => img.canvaDesignId);
  if (linkedImages.length === 0) return;

  let changed = false;

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
      const previousUrl = image.url;
      image.url = await saveUpload(`${image.id}-canva-${Date.now()}.png`, fetched.buffer);
      image.uploadedAt = new Date().toISOString();
      image.canvaSyncedAt = fetched.designUpdatedAt;
      await deleteUpload(previousUrl);
      changed = true;
      console.log(`[canva-sync] Updated image ${image.id} from design ${designId}`);
    } catch (err) {
      console.error(`[canva-sync] Failed to sync image ${image.id} (design ${designId}):`, err);
    }
  }

  if (changed) {
    await writeStore(store);
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
