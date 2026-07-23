import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import { DEFAULT_EMERGENCY_OVERRIDE } from "@/lib/types";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ emergencyOverride: store.emergencyOverride });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const store = await readStore();

  if (body.active === false) {
    store.emergencyOverride = DEFAULT_EMERGENCY_OVERRIDE;
    await writeStore(store);
    return NextResponse.json({ emergencyOverride: store.emergencyOverride });
  }

  const imageId = typeof body.imageId === "string" && body.imageId.trim() ? body.imageId : undefined;
  const message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : undefined;

  if (!imageId && !message) {
    return NextResponse.json(
      { error: "Provide an image, a message, or both." },
      { status: 400 }
    );
  }
  if (imageId && !store.images.some((img) => img.id === imageId)) {
    return NextResponse.json({ error: "That image no longer exists." }, { status: 400 });
  }

  store.emergencyOverride = {
    active: true,
    imageId,
    message,
    activatedAt: new Date().toISOString(),
  };
  await writeStore(store);
  return NextResponse.json({ emergencyOverride: store.emergencyOverride });
}
