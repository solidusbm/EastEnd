import { NextResponse } from "next/server";
import { isGithubBackupConfigured, listGithubBackups, listGithubPlaylistBackups } from "@/lib/githubBackup";
import { readStore } from "@/lib/store";
import { IMAGE_TYPES } from "@/lib/types";

/**
 * Lists what's backed up on GitHub per category, alongside how many of
 * those are already present locally (by matching filename) -- lets the
 * Setup UI show "12 available, 9 already imported" before importing. Also
 * lists backed-up playlists the same way, matched locally by id.
 */
export async function GET() {
  if (!(await isGithubBackupConfigured())) {
    return NextResponse.json({ configured: false, backups: null, playlistBackups: null });
  }

  const [backups, playlistBackups] = await Promise.all([listGithubBackups(), listGithubPlaylistBackups()]);
  const store = await readStore();
  const localFilenames = new Set(store.images.map((img) => img.url.split("/").pop()));
  const localPlaylistIds = new Set(store.savedPlaylists.map((p) => p.id));

  const result: Record<string, { filename: string; alreadyImported: boolean }[]> = {};
  for (const type of IMAGE_TYPES) {
    result[type] = (backups?.[type] ?? []).map((filename) => ({
      filename,
      alreadyImported: localFilenames.has(filename),
    }));
  }

  const playlistResult = (playlistBackups ?? []).map((p) => ({
    ...p,
    alreadyImported: localPlaylistIds.has(p.id),
  }));

  return NextResponse.json({ configured: true, backups: result, playlistBackups: playlistResult });
}
