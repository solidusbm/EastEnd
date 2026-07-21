import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { readStore, writeStore } from "@/lib/store";
import { IMAGE_TYPES, type ImageRecord, type ImageType } from "@/lib/types";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ images: store.images });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
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
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Uploaded file must be an image." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const filename = sanitizeFilename(file.name || "image");
  const blob = await put(`images/${id}-${filename}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  const image: ImageRecord = {
    id,
    url: blob.url,
    type: type as ImageType,
    label: typeof label === "string" ? label : "",
    uploadedAt: new Date().toISOString(),
  };

  const store = await readStore();
  store.images.push(image);
  await writeStore(store);

  return NextResponse.json({ image }, { status: 201 });
}
