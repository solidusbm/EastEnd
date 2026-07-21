import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import {
  DEFAULT_SCREEN_DEFAULTS,
  normalizeDurationSecondsByType,
  normalizeImageIdsByType,
  type Screen,
} from "@/lib/types";

const SLUG_PATTERN = /^[a-zA-Z0-9_-]{1,50}$/;

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ screens: store.screens });
}

function toPositiveInt(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : fallback;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const id = body.id;
  const name = body.name;

  if (typeof id !== "string" || !SLUG_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "id must be 1-50 characters of letters, numbers, hyphens, or underscores." },
      { status: 400 }
    );
  }
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const store = await readStore();
  if (store.screens.some((screen) => screen.id === id)) {
    return NextResponse.json({ error: `Screen id "${id}" already exists.` }, { status: 409 });
  }

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
  };

  store.screens.push(screen);
  await writeStore(store);

  return NextResponse.json({ screen }, { status: 201 });
}
