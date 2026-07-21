import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";
import type { ImageRecord } from "@/lib/types";

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
  const menuImages = screen.menuImageIds
    .map((id) => imageById.get(id))
    .filter((img): img is ImageRecord => Boolean(img));
  const foodImages = screen.foodImageIds
    .map((id) => imageById.get(id))
    .filter((img): img is ImageRecord => Boolean(img));

  return NextResponse.json(
    { screen, menuImages, foodImages },
    { headers: { "Cache-Control": "no-store" } }
  );
}
