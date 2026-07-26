"use client";

import { useState } from "react";
import type { ImageRecord, SavedPlaylist } from "@/lib/types";
import ImagePickerModal from "./ImagePickerModal";
import { moveId, toggleId } from "./TimingModeEditor";

const DEFAULT_PLAYLIST_IMAGE_DURATION = 10;

function PlaylistRow({
  playlist,
  images,
  onChanged,
  onDeleted,
  onImagesChanged,
}: {
  playlist: SavedPlaylist;
  images: ImageRecord[];
  onChanged: () => void;
  onDeleted: () => void;
  onImagesChanged: () => void;
}) {
  const [name, setName] = useState(playlist.name);
  const [imageIds, setImageIds] = useState(playlist.imageIds);
  const [imageDurationOverrides, setImageDurationOverrides] = useState(playlist.imageDurationOverrides);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [prevPlaylist, setPrevPlaylist] = useState(playlist);

  if (prevPlaylist !== playlist) {
    setPrevPlaylist(playlist);
    if (!dirty) {
      setName(playlist.name);
      setImageIds(playlist.imageIds);
      setImageDurationOverrides(playlist.imageDurationOverrides);
    }
  }

  const imageById = new Map(images.map((img) => [img.id, img]));

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/playlists/${playlist.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, imageIds, imageDurationOverrides }),
      });
      if (res.ok) {
        setDirty(false);
        onChanged();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete saved playlist "${playlist.name}"? Screens already using it keep their own copy.`)) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/playlists/${playlist.id}`, { method: "DELETE" });
      if (res.ok) onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setDirty(true);
            setName(e.target.value);
          }}
          placeholder="Playlist name"
          className="min-w-[160px] flex-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm font-medium outline-none focus:border-zinc-500"
        />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Edit images ({imageIds.length})
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="ml-auto rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {pickerOpen && (
        <ImagePickerModal
          title={`Edit "${playlist.name || "playlist"}" images`}
          images={images}
          selectedIds={imageIds}
          onToggle={(id) => {
            setDirty(true);
            setImageIds((prev) => toggleId(prev, id));
          }}
          onMove={(id, direction) => {
            setDirty(true);
            setImageIds((prev) => moveId(prev, id, direction));
          }}
          defaultDurationSeconds={DEFAULT_PLAYLIST_IMAGE_DURATION}
          durationOverrides={imageDurationOverrides}
          onDurationChange={(id, seconds) => {
            setDirty(true);
            setImageDurationOverrides((prev) => {
              const next = { ...prev };
              if (seconds === undefined) {
                delete next[id];
              } else {
                next[id] = seconds;
              }
              return next;
            });
          }}
          showTypeLabels
          onShowLabelChange={(id, showLabel) => {
            fetch(`/api/admin/images/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ showLabel }),
            }).then((res) => {
              if (res.ok) onImagesChanged();
            });
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {imageIds.length > 0 && (
        <p className="text-xs text-zinc-400">
          {imageIds
            .map((id) => imageById.get(id)?.label || id)
            .slice(0, 4)
            .join(", ")}
          {imageIds.length > 4 ? `, +${imageIds.length - 4} more` : ""}
        </p>
      )}
    </div>
  );
}

export default function PlaylistLibrary({
  savedPlaylists,
  images,
  onChanged,
  onImagesChanged,
}: {
  savedPlaylists: SavedPlaylist[];
  images: ImageRecord[];
  onChanged: () => void;
  onImagesChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const name = window.prompt("Name this playlist:");
    if (!name || !name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), imageIds: [], imageDurationOverrides: {} }),
      });
      if (res.ok) onChanged();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-zinc-500">
        Build reusable, named playlists here, then load one into any screen&apos;s fine-grain
        playlist from that screen&apos;s card. Editing a saved playlist later doesn&apos;t change
        screens that already loaded it -- they keep their own copy.
      </p>
      <button
        type="button"
        onClick={handleCreate}
        disabled={creating}
        className="w-fit rounded-md border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
      >
        {creating ? "Creating…" : "New playlist"}
      </button>

      {savedPlaylists.length === 0 ? (
        <p className="text-sm text-zinc-500">No saved playlists yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {savedPlaylists.map((playlist) => (
            <PlaylistRow
              key={playlist.id}
              playlist={playlist}
              images={images}
              onChanged={onChanged}
              onDeleted={onChanged}
              onImagesChanged={onImagesChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}
