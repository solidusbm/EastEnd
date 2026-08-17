import { NextResponse } from "next/server";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
import {
  DEFAULT_SCREEN_DEFAULTS,
  normalizeDurationSecondsByType,
  normalizeImageDurationOverrides,
  normalizeImageIdsByType,
  normalizePipConfig,
  normalizePlaylist,
  normalizeKeepAwake,
  normalizeScheduleRules,
  normalizeScrollConfig,
  normalizeTimingMode,
  type Screen,
} from "@/lib/types";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ screens: store.screens });
}

function toPositiveInt(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : fallback;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base.length > 0 ? base : "screen";
}

function uniqueSlug(name: string, existingIds: Set<string>): string {
  const base = slugify(name);
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  return withStoreLock(async () => {
    const store = await readStore();
    const id = uniqueSlug(name, new Set(store.screens.map((screen) => screen.id)));

    const screen: Screen = {
      id,
      name: name.trim(),
      imageIdsByType: normalizeImageIdsByType(body.imageIdsByType),
      durationSecondsByType: normalizeDurationSecondsByType(
        body.durationSecondsByType,
        DEFAULT_SCREEN_DEFAULTS.durationSecondsByType
      ),
      perImageDurationSeconds: toPositiveInt(
        body.perImageDurationSeconds,
        DEFAULT_SCREEN_DEFAULTS.perImageDurationSeconds
      ),
      imageDurationOverrides: normalizeImageDurationOverrides(body.imageDurationOverrides),
      timingMode: normalizeTimingMode(body.timingMode),
      playlist: normalizePlaylist(body.playlist),
      pip: normalizePipConfig(body.pip),
      scroll: normalizeScrollConfig(body.scroll),
      keepAwake: normalizeKeepAwake(body.keepAwake),
      scheduleRules: normalizeScheduleRules(body.scheduleRules),
    };

    store.screens.push(screen);
    await writeStore(store);

    return NextResponse.json({ screen }, { status: 201 });
  });
}
