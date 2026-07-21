import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { readStore, writeStore } from "@/lib/store";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = await readStore();
  const image = store.images.find((img) => img.id === id);

  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  await del(image.url).catch(() => {
    // Blob may already be gone; proceed to remove it from the config regardless.
  });

  store.images = store.images.filter((img) => img.id !== id);
  for (const screen of store.screens) {
    screen.menuImageIds = screen.menuImageIds.filter((imgId) => imgId !== id);
    screen.foodImageIds = screen.foodImageIds.filter((imgId) => imgId !== id);
  }

  await writeStore(store);

  return NextResponse.json({ ok: true });
}
