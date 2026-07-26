import { NextResponse } from "next/server";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
import { backupPlaylistToGithubBestEffort, buildPlaylistBackupPayload } from "@/lib/githubBackup";
import { normalizeImageDurationOverrides, normalizePlaylist, type SavedPlaylist } from "@/lib/types";

export async function GET() {
  const store = await readStore();
  return NextResponse.json({ savedPlaylists: store.savedPlaylists });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const playlist: SavedPlaylist = {
    id: crypto.randomUUID(),
    name: name.trim(),
    imageIds: normalizePlaylist(body.imageIds),
    imageDurationOverrides: normalizeImageDurationOverrides(body.imageDurationOverrides),
  };

  return withStoreLock(async () => {
    const store = await readStore();
    store.savedPlaylists.push(playlist);
    await writeStore(store);

    const imageById = new Map(store.images.map((img) => [img.id, img]));
    backupPlaylistToGithubBestEffort(playlist.id, buildPlaylistBackupPayload(playlist, imageById));

    return NextResponse.json({ savedPlaylist: playlist }, { status: 201 });
  });
}
