import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import {
  DEFAULT_EMERGENCY_OVERRIDE,
  DEFAULT_SCREEN_DEFAULTS,
  normalizeDurationSecondsByType,
  normalizeImageDurationOverrides,
  normalizeImageIdsByType,
  normalizeScheduleRules,
  type EmergencyOverride,
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
    imageDurationOverrides: normalizeImageDurationOverrides(raw.imageDurationOverrides),
    scheduleRules: normalizeScheduleRules(raw.scheduleRules),
    lastSeenAt: typeof raw.lastSeenAt === "string" ? raw.lastSeenAt : undefined,
    signageSyncedAt: typeof raw.signageSyncedAt === "string" ? raw.signageSyncedAt : undefined,
  };
}

function normalizeEmergencyOverride(raw: unknown): EmergencyOverride {
  const source = raw as Partial<EmergencyOverride> | undefined;
  if (!source || typeof source !== "object") return DEFAULT_EMERGENCY_OVERRIDE;
  return {
    active: source.active === true,
    imageId: typeof source.imageId === "string" ? source.imageId : undefined,
    message: typeof source.message === "string" ? source.message : undefined,
    activatedAt: typeof source.activatedAt === "string" ? source.activatedAt : undefined,
  };
}

export async function readStore(): Promise<StoreData> {
  let raw: string;
  try {
    raw = await readFile(CONFIG_PATH, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { images: [], screens: [], emergencyOverride: DEFAULT_EMERGENCY_OVERRIDE };
    }
    throw err;
  }

  const data = JSON.parse(raw) as {
    images?: StoreData["images"];
    screens?: Record<string, unknown>[];
    emergencyOverride?: unknown;
  };
  return {
    images: data.images ?? [],
    screens: (data.screens ?? []).map(normalizeScreen),
    emergencyOverride: normalizeEmergencyOverride(data.emergencyOverride),
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

// Every mutation is a read-modify-write of the whole file. Two of those
// running concurrently (e.g. a TV's display poll updating lastSeenAt while
// staff save a screen edit, or several bulk-edit requests at once) would
// otherwise each read the same starting snapshot and the second write wins,
// silently discarding whatever the first one changed. Queuing every
// read-modify-write cycle through this lock -- not just writeStore itself --
// makes them properly atomic relative to each other.
let storeLock: Promise<unknown> = Promise.resolve();

export function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = storeLock.then(fn, fn);
  storeLock = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}
