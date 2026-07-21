import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { readStore, writeStore } from "@/lib/store";
import { IMAGE_TYPES, type ImageType } from "@/lib/types";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

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
    const blob = await put(`images/${id}-${Date.now()}-${filename}`, file, {
      access: "public",
      addRandomSuffix: false,
    });
    image.url = blob.url;
    image.uploadedAt = new Date().toISOString();
    await del(previousUrl).catch(() => {
      // Old blob may already be gone; ignore.
    });
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

  await del(image.url).catch(() => {
    // Blob may already be gone; proceed to remove it from the config regardless.
  });

  store.images = store.images.filter((img) => img.id !== id);
  for (const screen of store.screens) {
    for (const type of IMAGE_TYPES) {
      screen.imageIdsByType[type] = screen.imageIdsByType[type].filter((imgId) => imgId !== id);
    }
  }

  await writeStore(store);

  return NextResponse.json({ ok: true });
}
