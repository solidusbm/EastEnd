import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { backupImageToGithubBestEffort } from "./githubBackup";
import type { ImageType } from "./types";

// Uploaded images are written into public/uploads so Next's static file
// server can serve them directly at runtime (no rebuild needed) — this
// directory is not committed, see .gitignore.
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");
const UPLOADS_URL_PREFIX = "/uploads/";

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

export async function saveUpload(type: ImageType, filename: string, content: Buffer): Promise<string> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, filename), content);
  // Best-effort, non-blocking permanent backup -- see lib/githubBackup.ts.
  backupImageToGithubBestEffort(type, filename, content);
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

export async function deleteUpload(url: string): Promise<void> {
  if (!url.startsWith(UPLOADS_URL_PREFIX)) return;
  const filePath = path.join(UPLOADS_DIR, url.slice(UPLOADS_URL_PREFIX.length));
  await unlink(filePath).catch(() => {
    // File may already be gone; ignore. Note: this never touches the GitHub
    // backup, which is intentionally permanent even after in-app deletion.
  });
}
