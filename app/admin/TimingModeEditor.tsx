"use client";

import { useState } from "react";
import {
  DEFAULT_DURATION_SECONDS,
  IMAGE_TYPE_LABELS,
  IMAGE_TYPES,
  type ImageRecord,
  type ImageType,
  type SavedPlaylist,
  type TimingMode,
} from "@/lib/types";
import ImagePickerModal from "./ImagePickerModal";

export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

export function moveId(ids: string[], id: string, direction: "up" | "down"): string[] {
  const index = ids.indexOf(id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

// A category is "the only one" when it has a nonzero duration and every
// other category is silenced (duration 0), matching how DisplayClient
// decides a category is unavailable.
function isOnlyCategory(type: ImageType, durations: Record<ImageType, number>): boolean {
  return durations[type] > 0 && IMAGE_TYPES.every((t) => t === type || durations[t] === 0);
}

/**
 * Everything needed to configure ONE rotation -- category timing vs
 * fine-grain playlist, its images/durations, and loading/saving playlists
 * from the shared library. Fully controlled (value + onChange props) so the
 * same component drives both a screen's main rotation and its independent
 * picture-in-picture overlay rotation, each with their own state slice.
 */
export default function TimingModeEditor({
  images,
  savedPlaylists,
  onPlaylistsChanged,
  onImagesChanged,
  timingMode,
  onTimingModeChange,
  imageIdsByType,
  onImageIdsByTypeChange,
  durationSecondsByType,
  onDurationSecondsByTypeChange,
  perImageDurationSeconds,
  onPerImageDurationSecondsChange,
  playlist,
  onPlaylistChange,
  imageDurationOverrides,
  onImageDurationOverridesChange,
}: {
  images: ImageRecord[];
  savedPlaylists: SavedPlaylist[];
  onPlaylistsChanged: () => void;
  onImagesChanged: () => void;
  timingMode: TimingMode;
  onTimingModeChange: (mode: TimingMode) => void;
  imageIdsByType: Record<ImageType, string[]>;
  onImageIdsByTypeChange: (updater: (prev: Record<ImageType, string[]>) => Record<ImageType, string[]>) => void;
  durationSecondsByType: Record<ImageType, number>;
  onDurationSecondsByTypeChange: (updater: (prev: Record<ImageType, number>) => Record<ImageType, number>) => void;
  perImageDurationSeconds: number;
  onPerImageDurationSecondsChange: (seconds: number) => void;
  playlist: string[];
  onPlaylistChange: (updater: (prev: string[]) => string[]) => void;
  imageDurationOverrides: Record<string, number>;
  onImageDurationOverridesChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
}) {
  const [activePicker, setActivePicker] = useState<ImageType | null>(null);
  const [playlistPickerOpen, setPlaylistPickerOpen] = useState(false);
  const [loadPlaylistId, setLoadPlaylistId] = useState("");
  const [savingAsPlaylist, setSavingAsPlaylist] = useState(false);

  const imagesByType = Object.fromEntries(
    IMAGE_TYPES.map((type) => [type, images.filter((image) => image.type === type)])
  ) as Record<ImageType, ImageRecord[]>;

  function applyOnlyCategory(type: ImageType) {
    onDurationSecondsByTypeChange((prev) => {
      const next = { ...prev };
      for (const t of IMAGE_TYPES) {
        next[t] = t === type ? (prev[t] > 0 ? prev[t] : DEFAULT_DURATION_SECONDS[t]) : 0;
      }
      return next;
    });
  }

  function restoreOtherCategories(exceptType: ImageType) {
    onDurationSecondsByTypeChange((prev) => {
      const next = { ...prev };
      for (const t of IMAGE_TYPES) {
        if (t !== exceptType) next[t] = DEFAULT_DURATION_SECONDS[t];
      }
      return next;
    });
  }

  function toggleOnlyCategory(type: ImageType) {
    if (isOnlyCategory(type, durationSecondsByType)) {
      restoreOtherCategories(type);
    } else {
      applyOnlyCategory(type);
    }
  }

  function isOnlyImage(type: ImageType, imageId: string): boolean {
    return (
      imageIdsByType[type].length === 1 &&
      imageIdsByType[type][0] === imageId &&
      isOnlyCategory(type, durationSecondsByType)
    );
  }

  function toggleOnlyImage(type: ImageType, imageId: string) {
    if (isOnlyImage(type, imageId)) {
      restoreOtherCategories(type);
      return;
    }
    onImageIdsByTypeChange((prev) => ({ ...prev, [type]: [imageId] }));
    applyOnlyCategory(type);
  }

  // Copies a saved playlist's images and durations into this rotation's own
  // playlist -- a one-time copy, not a live link, so editing the saved
  // playlist later never retroactively changes this rotation.
  function loadSavedPlaylist(saved: SavedPlaylist) {
    onPlaylistChange(() => saved.imageIds);
    onImageDurationOverridesChange((prev) => ({ ...prev, ...saved.imageDurationOverrides }));
  }

  async function saveCurrentAsPlaylist() {
    const name = window.prompt("Save this playlist as:");
    if (!name || !name.trim()) return;
    setSavingAsPlaylist(true);
    try {
      const overrides: Record<string, number> = {};
      for (const id of playlist) {
        if (imageDurationOverrides[id] !== undefined) overrides[id] = imageDurationOverrides[id];
      }
      const res = await fetch("/api/admin/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), imageIds: playlist, imageDurationOverrides: overrides }),
      });
      if (res.ok) onPlaylistsChanged();
    } finally {
      setSavingAsPlaylist(false);
    }
  }

  function handleShowLabelChange(id: string, showLabel: boolean) {
    fetch(`/api/admin/images/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showLabel }),
    }).then((res) => {
      if (res.ok) onImagesChanged();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex w-fit items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => onTimingModeChange("fineGrain")}
            className={`rounded-md px-3 py-1.5 ${
              timingMode === "fineGrain"
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            Fine-grain control
          </button>
          <button
            type="button"
            onClick={() => onTimingModeChange("category")}
            className={`rounded-md px-3 py-1.5 ${
              timingMode === "category"
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            Category timing
          </button>
        </div>
        <p className="text-[11px] text-zinc-400">
          {timingMode === "category"
            ? "Cycles each category as a block, in the order and durations set below."
            : "Plays the playlist below as one manually ordered sequence, ignoring category grouping."}
        </p>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Per-image duration (s)
        <input
          type="number"
          min={1}
          value={perImageDurationSeconds}
          onChange={(e) => onPerImageDurationSecondsChange(Number(e.target.value))}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
        />
      </label>

      {timingMode === "category" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {IMAGE_TYPES.map((type) => (
            <div
              key={type}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {IMAGE_TYPE_LABELS[type]}
                </p>
                <label
                  className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400"
                  title={`Show only ${IMAGE_TYPE_LABELS[type]}`}
                >
                  <input
                    type="checkbox"
                    checked={isOnlyCategory(type, durationSecondsByType)}
                    onChange={() => toggleOnlyCategory(type)}
                  />
                  Only
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Duration (s)
                <input
                  type="number"
                  min={1}
                  value={durationSecondsByType[type]}
                  onChange={(e) =>
                    onDurationSecondsByTypeChange((prev) => ({ ...prev, [type]: Number(e.target.value) }))
                  }
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
                />
              </label>
              <button
                type="button"
                onClick={() => setActivePicker(type)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Select {IMAGE_TYPE_LABELS[type]} images ({imageIdsByType[type].length})
              </button>
            </div>
          ))}
        </div>
      )}

      {timingMode === "fineGrain" && (
        <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Playlist</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPlaylistPickerOpen(true)}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Manage playlist images ({playlist.length})
            </button>
            <button
              type="button"
              onClick={saveCurrentAsPlaylist}
              disabled={savingAsPlaylist || playlist.length === 0}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              {savingAsPlaylist ? "Saving…" : "Save as playlist…"}
            </button>
          </div>
          {savedPlaylists.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={loadPlaylistId}
                onChange={(e) => setLoadPlaylistId(e.target.value)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 px-2 py-1.5 text-xs outline-none focus:border-zinc-500"
              >
                <option value="">Load a saved playlist…</option>
                {savedPlaylists.map((saved) => (
                  <option key={saved.id} value={saved.id}>
                    {saved.name || "Untitled"} ({saved.imageIds.length})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const saved = savedPlaylists.find((p) => p.id === loadPlaylistId);
                  if (saved) loadSavedPlaylist(saved);
                }}
                disabled={!loadPlaylistId}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Load
              </button>
            </div>
          )}
        </div>
      )}

      {activePicker && (
        <ImagePickerModal
          title={`Select ${IMAGE_TYPE_LABELS[activePicker]} images`}
          images={imagesByType[activePicker]}
          selectedIds={imageIdsByType[activePicker]}
          onToggle={(id) =>
            onImageIdsByTypeChange((prev) => ({ ...prev, [activePicker]: toggleId(prev[activePicker], id) }))
          }
          onlyImageId={
            imageIdsByType[activePicker].length === 1 && isOnlyCategory(activePicker, durationSecondsByType)
              ? imageIdsByType[activePicker][0]
              : null
          }
          onToggleOnly={(id) => toggleOnlyImage(activePicker, id)}
          onMove={(id, direction) =>
            onImageIdsByTypeChange((prev) => ({ ...prev, [activePicker]: moveId(prev[activePicker], id, direction) }))
          }
          defaultDurationSeconds={perImageDurationSeconds}
          durationOverrides={imageDurationOverrides}
          onDurationChange={(id, seconds) =>
            onImageDurationOverridesChange((prev) => {
              const next = { ...prev };
              if (seconds === undefined) delete next[id];
              else next[id] = seconds;
              return next;
            })
          }
          onShowLabelChange={handleShowLabelChange}
          onClose={() => setActivePicker(null)}
        />
      )}

      {playlistPickerOpen && (
        <ImagePickerModal
          title="Manage playlist images"
          images={images}
          selectedIds={playlist}
          onToggle={(id) => onPlaylistChange((prev) => toggleId(prev, id))}
          onMove={(id, direction) => onPlaylistChange((prev) => moveId(prev, id, direction))}
          defaultDurationSeconds={perImageDurationSeconds}
          durationOverrides={imageDurationOverrides}
          onDurationChange={(id, seconds) =>
            onImageDurationOverridesChange((prev) => {
              const next = { ...prev };
              if (seconds === undefined) delete next[id];
              else next[id] = seconds;
              return next;
            })
          }
          showTypeLabels
          onShowLabelChange={handleShowLabelChange}
          onClose={() => setPlaylistPickerOpen(false)}
        />
      )}
    </div>
  );
}
