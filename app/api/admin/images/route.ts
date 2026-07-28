import { NextResponse } from "next/server";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
import { saveUpload, sanitizeFilename } from "@/lib/uploads";
import { isAcceptedUploadMimeType, mediaKind, MAX_VIDEO_BYTES } from "@/lib/media";
import { IMAGE_TYPES, type ImageRecord, type ImageType } from "@/lib/types";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ images: store.images });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const type = formData.get("type");
  const label = formData.get("label");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (typeof type !== "string" || !IMAGE_TYPES.includes(type as ImageType)) {
    return NextResponse.json(
      { error: `type must be one of: ${IMAGE_TYPES.join(", ")}.` },
      { status: 400 }
    );
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

  const id = crypto.randomUUID();
  const filename = sanitizeFilename(file.name || "image");
  const url = await saveUpload(
    type as ImageType,
    `${id}-${filename}`,
    Buffer.from(await file.arrayBuffer())
  );

  const image: ImageRecord = {
    id,
    url,
    type: type as ImageType,
    label: typeof label === "string" ? label : "",
    uploadedAt: new Date().toISOString(),
  };

  await withStoreLock(async () => {
    const store = await readStore();
    store.images.push(image);
    await writeStore(store);
  });

  return NextResponse.json({ image }, { status: 201 });
}
