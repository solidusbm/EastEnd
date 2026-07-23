import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import { IMAGE_TYPES, type ImageRecord, type ImageType } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const { screenId } = await params;
  const store = await readStore();
  const screen = store.screens.find((s) => s.id === screenId);

  if (!screen) {
    return NextResponse.json(
      { error: "Screen not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const imageById = new Map<string, ImageRecord>(store.images.map((img) => [img.id, img]));
  const imagesByType = {} as Record<ImageType, ImageRecord[]>;
  for (const type of IMAGE_TYPES) {
    imagesByType[type] = screen.imageIdsByType[type]
      .map((id) => imageById.get(id))
      .filter((img): img is ImageRecord => Boolean(img));
  }

  const override = store.emergencyOverride.active
    ? {
        active: true as const,
        message: store.emergencyOverride.message,
        imageUrl: store.emergencyOverride.imageId
          ? (imageById.get(store.emergencyOverride.imageId)?.url ?? null)
          : null,
      }
    : null;

  return NextResponse.json(
    { screen, imagesByType, emergencyOverride: override },
    { headers: { "Cache-Control": "no-store" } }
  );
}
