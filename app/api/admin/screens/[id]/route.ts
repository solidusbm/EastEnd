import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";

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

  const store = await readStore();
  const screen = store.screens.find((s) => s.id === id);
  if (!screen) {
    return NextResponse.json({ error: "Screen not found." }, { status: 404 });
  }

  if (typeof body.name === "string" && body.name.trim().length > 0) {
    screen.name = body.name.trim();
  }
  if (Array.isArray(body.menuImageIds)) {
    screen.menuImageIds = body.menuImageIds.filter((v): v is string => typeof v === "string");
  }
  if (Array.isArray(body.foodImageIds)) {
    screen.foodImageIds = body.foodImageIds.filter((v): v is string => typeof v === "string");
  }
  if (body.menuDurationSeconds !== undefined) {
    screen.menuDurationSeconds = toPositiveInt(body.menuDurationSeconds, screen.menuDurationSeconds);
  }
  if (body.foodDurationSeconds !== undefined) {
    screen.foodDurationSeconds = toPositiveInt(body.foodDurationSeconds, screen.foodDurationSeconds);
  }
  if (body.perImageDurationSeconds !== undefined) {
    screen.perImageDurationSeconds = toPositiveInt(
      body.perImageDurationSeconds,
      screen.perImageDurationSeconds
    );
  }

  await writeStore(store);

  return NextResponse.json({ screen });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = await readStore();
  const exists = store.screens.some((s) => s.id === id);
  if (!exists) {
    return NextResponse.json({ error: "Screen not found." }, { status: 404 });
  }

  store.screens = store.screens.filter((s) => s.id !== id);
  await writeStore(store);

  return NextResponse.json({ ok: true });
}
