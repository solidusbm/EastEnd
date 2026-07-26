import { NextResponse } from "next/server";
import { readStore, withStoreLock, writeStore } from "@/lib/store";
import { backupPlaylistToGithubBestEffort, buildPlaylistBackupPayload } from "@/lib/githubBackup";
import { normalizeImageDurationOverrides, normalizePlaylist } from "@/lib/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  return withStoreLock(async () => {
    const store = await readStore();
    const playlist = store.savedPlaylists.find((p) => p.id === id);
    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
    }

    if (typeof body.name === "string" && body.name.trim().length > 0) {
      playlist.name = body.name.trim();
    }
    if (body.imageIds !== undefined) {
      playlist.imageIds = normalizePlaylist(body.imageIds);
    }
    if (body.imageDurationOverrides !== undefined) {
      playlist.imageDurationOverrides = normalizeImageDurationOverrides(body.imageDurationOverrides);
    }

    await writeStore(store);

    const imageById = new Map(store.images.map((img) => [img.id, img]));
    backupPlaylistToGithubBestEffort(playlist.id, buildPlaylistBackupPayload(playlist, imageById));

    return NextResponse.json({ savedPlaylist: playlist });
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withStoreLock(async () => {
    const store = await readStore();
    const exists = store.savedPlaylists.some((p) => p.id === id);
    if (!exists) {
      return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
    }

    // Matches image deletes: this never touches the GitHub backup, which is
    // intentionally a permanent, one-way archive.
    store.savedPlaylists = store.savedPlaylists.filter((p) => p.id !== id);
    await writeStore(store);

    return NextResponse.json({ ok: true });
  });
}
