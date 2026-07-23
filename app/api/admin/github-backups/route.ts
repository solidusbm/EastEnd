import { NextResponse } from "next/server";
import { isGithubBackupConfigured, listGithubBackups } from "@/lib/githubBackup";
import { readStore } from "@/lib/store";
import { IMAGE_TYPES } from "@/lib/types";

/**
 * Lists what's backed up on GitHub per category, alongside how many of
 * those are already present locally (by matching filename) -- lets the
 * Setup UI show "12 available, 9 already imported" before importing.
 */
export async function GET() {
  if (!(await isGithubBackupConfigured())) {
    return NextResponse.json({ configured: false, backups: null });
  }

  const backups = await listGithubBackups();
  const store = await readStore();
  const localFilenames = new Set(store.images.map((img) => img.url.split("/").pop()));

  const result: Record<string, { filename: string; alreadyImported: boolean }[]> = {};
  for (const type of IMAGE_TYPES) {
    result[type] = (backups?.[type] ?? []).map((filename) => ({
      filename,
      alreadyImported: localFilenames.has(filename),
    }));
  }

  return NextResponse.json({ configured: true, backups: result });
}
