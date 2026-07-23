import { NextResponse } from "next/server";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
import { saveUpload } from "@/lib/uploads";
import { fetchCanvaImage, getValidAccessToken, parseCanvaDesignId } from "@/lib/canva";
import { IMAGE_TYPES, type ImageRecord, type ImageType } from "@/lib/types";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const rawUrl = body.url;
  const type = body.type;
  const label = body.label;

  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) {
    return NextResponse.json({ error: "A Canva design URL (or ID) is required." }, { status: 400 });
  }
  if (typeof type !== "string" || !IMAGE_TYPES.includes(type as ImageType)) {
    return NextResponse.json(
      { error: `type must be one of: ${IMAGE_TYPES.join(", ")}.` },
      { status: 400 }
    );
  }

  const designId = parseCanvaDesignId(rawUrl);
  if (!designId) {
    return NextResponse.json({ error: "Could not find a design ID in that Canva URL." }, { status: 400 });
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
    fetched = await fetchCanvaImage(accessToken, designId);
  } catch (err) {
    console.error("[canva] Import failed:", err);
    const message = err instanceof Error ? err.message : "Failed to fetch the design from Canva.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const id = crypto.randomUUID();
  const url = await saveUpload(type as ImageType, `${id}-canva-${designId}.png`, fetched.buffer);

  const image: ImageRecord = {
    id,
    url,
    type: type as ImageType,
    label: typeof label === "string" && label.trim().length > 0 ? label : fetched.designTitle,
    uploadedAt: new Date().toISOString(),
    canvaDesignId: designId,
    canvaSyncedAt: fetched.designUpdatedAt,
  };

  await withStoreLock(async () => {
    const store = await readStore();
    store.images.push(image);
    await writeStore(store);
  });

  return NextResponse.json({ image }, { status: 201 });
}
