import { NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";
import { deleteUpload, saveUpload, sanitizeFilename } from "@/lib/uploads";
import { IMAGE_TYPES, type ImageType } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = await readStore();
  const image = store.images.find((img) => img.id === id);
  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Uploaded file must be an image." }, { status: 400 });
    }

    const previousUrl = image.url;
    const filename = sanitizeFilename(file.name || "image");
    image.url = await saveUpload(`${id}-${Date.now()}-${filename}`, file);
    image.uploadedAt = new Date().toISOString();
    await deleteUpload(previousUrl);
  } else {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (typeof body.label === "string") {
      image.label = body.label;
    }
    if (typeof body.type === "string") {
      if (!IMAGE_TYPES.includes(body.type as ImageType)) {
        return NextResponse.json(
          { error: `type must be one of: ${IMAGE_TYPES.join(", ")}.` },
          { status: 400 }
        );
      }
      image.type = body.type as ImageType;
    }
  }

  await writeStore(store);
  return NextResponse.json({ image });
}

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

  await deleteUpload(image.url);

  store.images = store.images.filter((img) => img.id !== id);
  for (const screen of store.screens) {
    for (const type of IMAGE_TYPES) {
      screen.imageIdsByType[type] = screen.imageIdsByType[type].filter((imgId) => imgId !== id);
    }
  }

  await writeStore(store);

  return NextResponse.json({ ok: true });
}
