import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { backupImageToGithubBestEffort } from "./githubBackup";
import { mediaKind } from "./media";
import type { ImageType } from "./types";

// Uploaded images are written into public/uploads so Next's static file
// server can serve them directly at runtime (no rebuild needed) — this
// directory is not committed, see .gitignore.
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const UPLOADS_URL_PREFIX = "/uploads/";

// Phone photos routinely come in at 4000px+ on a side, which is wasted
// detail for a TV and slow to decode on the older WebOS/Tizen browsers this
// app targets (see README). Capping the longest side keeps files smaller
// without a visible quality loss at TV viewing distance; images already
// under this size pass through unchanged (withoutEnlargement).
const MAX_DIMENSION = 2560;

async function resizeForDisplay(content: Buffer, filename: string): Promise<Buffer> {
  const kind = mediaKind(filename);
  // sharp is an image library -- it can't touch video at all, so skip
  // straight through. It never got a chance to shrink these on disk before.
  if (kind === "video") return content;

  try {
    return await sharp(content, kind === "gif" ? { animated: true } : undefined)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .toBuffer();
  } catch {
    // Not an image format sharp can decode (or already fine) -- keep the original bytes.
    return content;
  }
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

export async function saveUpload(type: ImageType, filename: string, content: Buffer): Promise<string> {
  const resized = await resizeForDisplay(content, filename);
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, filename), resized);
  // Best-effort, non-blocking permanent backup -- see lib/githubBackup.ts.
  backupImageToGithubBestEffort(type, filename, resized);
  return `${UPLOADS_URL_PREFIX}${filename}`;
}

/**
 * Writes a file that was just downloaded FROM a GitHub backup, without
 * re-uploading it back to GitHub (it's already there -- that's where it
 * came from). Used by the "restore from GitHub" import flow.
 */
export async function restoreUpload(filename: string, content: Buffer): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, filename), content);
  return `${UPLOADS_URL_PREFIX}${filename}`;
}

/** Reads an already-saved upload's raw bytes by filename, for re-backing-up existing images. */
export async function readUploadFile(filename: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(UPLOADS_DIR, filename));
  } catch {
    return null;
  }
}

export async function deleteUpload(url: string): Promise<void> {
  if (!url.startsWith(UPLOADS_URL_PREFIX)) return;
  const filePath = path.join(UPLOADS_DIR, url.slice(UPLOADS_URL_PREFIX.length));
  await unlink(filePath).catch(() => {
    // File may already be gone; ignore. Note: this never touches the GitHub
    // backup, which is intentionally permanent even after in-app deletion.
  });
}
