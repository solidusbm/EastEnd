import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import { deleteUpload, saveUpload } from "@/lib/uploads";
import { fetchCanvaImage, getValidAccessToken } from "@/lib/canva";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = await readStore();
  const image = store.images.find((img) => img.id === id);

  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
  if (!image.canvaDesignId) {
    return NextResponse.json({ error: "This image isn't linked to a Canva design." }, { status: 400 });
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Canva isn't connected. Connect it from the admin dashboard first." },
      { status: 400 }
    );
  }

  let fetched;
  try {
    fetched = await fetchCanvaImage(accessToken, image.canvaDesignId);
  } catch (err) {
    console.error("[canva] Manual resync failed:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch the design from Canva.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const previousUrl = image.url;
  image.url = await saveUpload(image.type, `${id}-canva-${Date.now()}.png`, fetched.buffer);
  image.uploadedAt = new Date().toISOString();
  image.canvaSyncedAt = fetched.designUpdatedAt;
  await deleteUpload(previousUrl);

  await writeStore(store);
  return NextResponse.json({ image });
}
