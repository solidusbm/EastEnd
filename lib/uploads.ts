import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

// Uploaded images are written into public/uploads so Next's static file
// server can serve them directly at runtime (no rebuild needed) — this
// directory is not committed, see .gitignore.
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const UPLOADS_URL_PREFIX = "/uploads/";

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

export async function saveUpload(filename: string, file: File): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOADS_DIR, filename), buffer);
  return `${UPLOADS_URL_PREFIX}${filename}`;
}

export async function deleteUpload(url: string): Promise<void> {
  if (!url.startsWith(UPLOADS_URL_PREFIX)) return;
  const filePath = path.join(UPLOADS_DIR, url.slice(UPLOADS_URL_PREFIX.length));
  await unlink(filePath).catch(() => {
    // File may already be gone; ignore.
  });
}
