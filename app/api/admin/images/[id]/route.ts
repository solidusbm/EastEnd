import { NextResponse } from "next/server";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
import { deleteUpload, saveUpload, sanitizeFilename } from "@/lib/uploads";
import { isAcceptedUploadMimeType, mediaKind, MAX_VIDEO_BYTES } from "@/lib/media";
import { IMAGE_TYPES, type ImageType } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withStoreLock(async () => {
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
      if (!isAcceptedUploadMimeType(file.type)) {
        return NextResponse.json({ error: "Uploaded file must be an image or an MP4 video." }, { status: 400 });
      }
      if (mediaKind(file.name) === "video" && file.size > MAX_VIDEO_BYTES) {
        return NextResponse.json(
          { error: `Video files must be ${MAX_VIDEO_BYTES / (1024 * 1024)}MB or smaller.` },
          { status: 400 }
        );
      }

      const previousUrl = image.url;
      const filename = sanitizeFilename(file.name || "image");
      image.url = await saveUpload(
        image.type,
        `${id}-${Date.now()}-${filename}`,
        Buffer.from(await file.arrayBuffer())
      );
      image.uploadedAt = new Date().toISOString();
      // A manual replace overrides Canva sync -- otherwise the next background
      // sync would silently discard this replacement.
      delete image.canvaDesignId;
      delete image.canvaSyncedAt;
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
      if (typeof body.showLabel === "boolean") {
        image.showLabel = body.showLabel;
      }
      if (body.unlinkCanva === true) {
        delete image.canvaDesignId;
        delete image.canvaSyncedAt;
      }
    }

    await writeStore(store);
    return NextResponse.json({ image });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withStoreLock(async () => {
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
  });
}
