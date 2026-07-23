import { NextResponse } from "next/server";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
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
  const url = await saveUpload(image.type, `${id}-canva-${Date.now()}.png`, fetched.buffer);
  const uploadedAt = new Date().toISOString();

  const result = await withStoreLock(async () => {
    const freshStore = await readStore();
    const freshImage = freshStore.images.find((img) => img.id === id);
    if (!freshImage) {
      return NextResponse.json({ error: "Image was deleted during resync." }, { status: 404 });
    }
    freshImage.url = url;
    freshImage.uploadedAt = uploadedAt;
    freshImage.canvaSyncedAt = fetched.designUpdatedAt;
    await writeStore(freshStore);
    return NextResponse.json({ image: freshImage });
  });

  await deleteUpload(previousUrl);
  return result;
}
