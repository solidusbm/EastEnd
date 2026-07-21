import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import {
  DEFAULT_SCREEN_DEFAULTS,
  normalizeDurationSecondsByType,
  normalizeImageIdsByType,
  type Screen,
  type StoreData,
} from "./types";

// Config lives as a single JSON file on local disk (not committed — see
// .gitignore) rather than a cloud store, so this app can run fully offline
// on the machine hosting it.
const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

function toPositiveInt(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : fallback;
}

// Migrates pre-multi-category screens (`menuImageIds`/`foodImageIds`/
// `menuDurationSeconds`/`foodDurationSeconds`) into the current shape so old
// config.json files keep working after the data model changed.
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

export async function readStore(): Promise<StoreData> {
  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { images: [], screens: [] };
    throw err;
  }

  const data = JSON.parse(raw) as { images?: StoreData["images"]; screens?: Record<string, unknown>[] };
  return {
    images: data.images ?? [],
    screens: (data.screens ?? []).map(normalizeScreen),
  };
}

export async function writeStore(data: StoreData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  // Write to a temp file and rename over the real one so a crash mid-write
  // (or a concurrent read) never sees a half-written config.json.
  const tmpPath = `${CONFIG_PATH}.${process.pid}.tmp`;
  await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmpPath, CONFIG_PATH);
}
