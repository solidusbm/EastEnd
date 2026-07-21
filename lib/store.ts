import { del, list, put } from "@vercel/blob";
import {
  DEFAULT_SCREEN_DEFAULTS,
  normalizeDurationSecondsByType,
  normalizeImageIdsByType,
  type Screen,
  type StoreData,
} from "./types";

// Config is stored as `config-<timestamp>-<random>.json` and each write
// creates a brand-new blob (deleting the old one afterwards) rather than
// overwriting one fixed pathname. The public blob CDN caches by URL and
// ignores query strings for that decision, so overwriting one fixed URL
// means reads can keep serving stale, pre-write content for well over its
// nominal cache lifetime; giving every write its own never-before-seen URL
// sidesteps that entirely. `list()` hits Blob's management API (not the
// CDN), so it always reflects the latest write.
const CONFIG_PREFIX = "config";

function toPositiveInt(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : fallback;
}

// Migrates pre-multi-category screens (`menuImageIds`/`foodImageIds`/
// `menuDurationSeconds`/`foodDurationSeconds`) into the current shape so old
// config.json blobs keep working after the data model changed.
function normalizeScreen(raw: Record<string, unknown>): Screen {
  const imageIdsSource = {
    ...(raw.imageIdsByType as Record<string, unknown> | undefined),
    menu: (raw.imageIdsByType as Record<string, unknown> | undefined)?.menu ?? raw.menuImageIds,
    food: (raw.imageIdsByType as Record<string, unknown> | undefined)?.food ?? raw.foodImageIds,
  };
  const durationSource = {
    ...(raw.durationSecondsByType as Record<string, unknown> | undefined),
    menu:
      (raw.durationSecondsByType as Record<string, unknown> | undefined)?.menu ??
      raw.menuDurationSeconds,
    food:
      (raw.durationSecondsByType as Record<string, unknown> | undefined)?.food ??
      raw.foodDurationSeconds,
  };

  return {
    id: raw.id as string,
    name: raw.name as string,
    imageIdsByType: normalizeImageIdsByType(imageIdsSource),
    durationSecondsByType: normalizeDurationSecondsByType(durationSource),
    perImageDurationSeconds: toPositiveInt(
      raw.perImageDurationSeconds,
      DEFAULT_SCREEN_DEFAULTS.perImageDurationSeconds
    ),
  };
}

async function findLatestConfigBlob(): Promise<{ url: string; uploadedAt: Date } | null> {
  const { blobs } = await list({ prefix: CONFIG_PREFIX, limit: 20 });
  const matches = blobs.filter((blob) => blob.pathname.startsWith(CONFIG_PREFIX));
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  return matches[0];
}

export async function readStore(): Promise<StoreData> {
  const current = await findLatestConfigBlob();
  if (!current) return { images: [], screens: [] };

  const res = await fetch(current.url, { cache: "no-store" });
  if (!res.ok) return { images: [], screens: [] };

  const data = (await res.json()) as { images?: StoreData["images"]; screens?: Record<string, unknown>[] };
  return {
    images: data.images ?? [],
    screens: (data.screens ?? []).map(normalizeScreen),
  };
}

export async function writeStore(data: StoreData): Promise<void> {
  const previous = await findLatestConfigBlob();

  await put(`${CONFIG_PREFIX}-${Date.now()}.json`, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/json",
  });

  if (previous) {
    await del(previous.url).catch(() => {
      // Best-effort cleanup; a leftover old version is harmless.
    });
  }
}
