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
  ".mp4": "video/mp4",
};

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/;

export async function GET(
  request: Request,
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
  // Filenames are unique per upload and never reused for different content,
  // so caching them as immutable is safe.
  const cacheControl = "public, max-age=31536000, immutable";

  // Video playback (seeking in particular) depends on Range support in some
  // browsers -- images ignore this since they never request a Range, so
  // it's harmless to handle unconditionally rather than only for video.
  const range = request.headers.get("range");
  const match = range ? RANGE_PATTERN.exec(range) : null;
  if (match) {
    const total = content.length;
    const start = match[1] ? parseInt(match[1], 10) : 0;
    const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
    if (start <= end && start < total) {
      const chunk = content.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.length),
          "Cache-Control": cacheControl,
        },
      });
    }
  }

  return new NextResponse(new Uint8Array(content), {
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
    },
  });
}
