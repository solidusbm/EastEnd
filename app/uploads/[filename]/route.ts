import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

// Next.js only recognizes public/ files that existed at the last `next
// build` -- anything saveUpload() writes at runtime afterward isn't in that
// build-time manifest, so a request for it falls through to the app router
// and 404s (and that 404 can even get cached). This route re-serves the
// same /uploads/<filename> URLs by reading straight from disk on every
// request, so newly uploaded images work without a rebuild. Pre-existing
// files already in the manifest keep being served by Next's static handler
// and never reach this route.
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let content: Buffer;
  try {
    content = await readFile(path.join(UPLOADS_DIR, filename));
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": contentType,
      // Filenames are unique per upload and never reused for different
      // content, so caching them as immutable is safe.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
