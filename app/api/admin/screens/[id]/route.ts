import { NextResponse } from "next/server";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
import {
  normalizeDurationSecondsByType,
  normalizeImageDurationOverrides,
  normalizeImageIdsByType,
  normalizeScheduleRules,
} from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = await readStore();
  const screen = store.screens.find((s) => s.id === id);
  if (!screen) {
    return NextResponse.json({ error: "Screen not found." }, { status: 404 });
  }
  return NextResponse.json({ screen });
}

function toPositiveInt(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : fallback;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  return withStoreLock(async () => {
    const store = await readStore();
    const screen = store.screens.find((s) => s.id === id);
    if (!screen) {
      return NextResponse.json({ error: "Screen not found." }, { status: 404 });
    }

    if (typeof body.name === "string" && body.name.trim().length > 0) {
      screen.name = body.name.trim();
    }
    if (body.imageIdsByType !== undefined) {
      screen.imageIdsByType = normalizeImageIdsByType(body.imageIdsByType);
    }
    if (body.durationSecondsByType !== undefined) {
      screen.durationSecondsByType = normalizeDurationSecondsByType(
        body.durationSecondsByType,
        screen.durationSecondsByType
      );
    }
    if (body.perImageDurationSeconds !== undefined) {
      screen.perImageDurationSeconds = toPositiveInt(
        body.perImageDurationSeconds,
        screen.perImageDurationSeconds
      );
    }
    if (body.imageDurationOverrides !== undefined) {
      screen.imageDurationOverrides = normalizeImageDurationOverrides(body.imageDurationOverrides);
    }
    if (body.scheduleRules !== undefined) {
      screen.scheduleRules = normalizeScheduleRules(body.scheduleRules);
    }

    await writeStore(store);

    return NextResponse.json({ screen });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withStoreLock(async () => {
    const store = await readStore();
    const exists = store.screens.some((s) => s.id === id);
    if (!exists) {
      return NextResponse.json({ error: "Screen not found." }, { status: 404 });
    }

    store.screens = store.screens.filter((s) => s.id !== id);
    await writeStore(store);

    return NextResponse.json({ ok: true });
  });
}
