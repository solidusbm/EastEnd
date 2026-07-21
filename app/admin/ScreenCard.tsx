"use client";

import { useState } from "react";
import {
  DEFAULT_DURATION_SECONDS,
  IMAGE_TYPE_LABELS,
  IMAGE_TYPES,
  type ImageRecord,
  type ImageType,
  type Screen,
} from "@/lib/types";
import ImagePickerModal from "./ImagePickerModal";

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
}

// A category is "the only one" when it has a nonzero duration and every
// other category is silenced (duration 0), matching how DisplayClient
// decides a category is unavailable.
function isOnlyCategory(type: ImageType, durations: Record<ImageType, number>): boolean {
  return durations[type] > 0 && IMAGE_TYPES.every((t) => t === type || durations[t] === 0);
}

export default function ScreenCard({
  screen,
  images,
  onUpdated,
  onDeleted,
}: {
  screen: Screen;
  images: ImageRecord[];
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(screen.name);
  const [durationSecondsByType, setDurationSecondsByType] = useState(screen.durationSecondsByType);
  const [perImageDurationSeconds, setPerImageDurationSeconds] = useState(
    screen.perImageDurationSeconds
  );
  const [imageIdsByType, setImageIdsByType] = useState(screen.imageIdsByType);
  const [activePicker, setActivePicker] = useState<ImageType | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevScreen, setPrevScreen] = useState(screen);
  const displayPath = `/display/${screen.id}`;

  if (prevScreen !== screen) {
    setPrevScreen(screen);
    setName(screen.name);
    setDurationSecondsByType(screen.durationSecondsByType);
    setPerImageDurationSeconds(screen.perImageDurationSeconds);
    setImageIdsByType(screen.imageIdsByType);
  }

  const imagesByType = Object.fromEntries(
    IMAGE_TYPES.map((type) => [type, images.filter((image) => image.type === type)])
  ) as Record<ImageType, ImageRecord[]>;

  // Silences every other category, leaving `type` as the only one this
  // screen cycles through.
  function applyOnlyCategory(type: ImageType) {
    setDurationSecondsByType((prev) => {
      const next = { ...prev };
      for (const t of IMAGE_TYPES) {
        next[t] = t === type ? (prev[t] > 0 ? prev[t] : DEFAULT_DURATION_SECONDS[t]) : 0;
      }
      return next;
    });
  }

  // Undoes applyOnlyCategory by giving every other category back its
  // default duration (we don't track prior per-screen values to restore).
  function restoreOtherCategories(exceptType: ImageType) {
    setDurationSecondsByType((prev) => {
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
    setImageIdsByType((prev) => ({ ...prev, [type]: [imageId] }));
    applyOnlyCategory(type);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/screens/${screen.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          durationSecondsByType,
          perImageDurationSeconds,
          imageIdsByType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save screen.");
        return;
      }
      onUpdated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete screen "${screen.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/screens/${screen.id}`, { method: "DELETE" });
      if (res.ok) onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  async function copyDisplayUrl() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${displayPath}`);
    } catch {
      // Clipboard access can fail (e.g. insecure context); ignore silently.
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Screen name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm font-medium outline-none focus:border-zinc-500"
          />
          <span className="text-xs text-zinc-400">id: {screen.id}</span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <a
            href={`/display/${screen.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Open display →
          </a>
          <div className="flex items-center gap-2">
            <code className="max-w-[220px] truncate rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              {displayPath}
            </code>
            <button
              onClick={copyDisplayUrl}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Per-image duration (s)
        <input
          type="number"
          min={1}
          value={perImageDurationSeconds}
          onChange={(e) => setPerImageDurationSeconds(Number(e.target.value))}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
        />
      </label>

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
                title={`Show only ${IMAGE_TYPE_LABELS[type]} on this screen`}
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
                  setDurationSecondsByType((prev) => ({
                    ...prev,
                    [type]: Number(e.target.value),
                  }))
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

      {activePicker && (
        <ImagePickerModal
          title={`Select ${IMAGE_TYPE_LABELS[activePicker]} images`}
          images={imagesByType[activePicker]}
          selectedIds={imageIdsByType[activePicker]}
          onToggle={(id) =>
            setImageIdsByType((prev) => ({
              ...prev,
              [activePicker]: toggleId(prev[activePicker], id),
            }))
          }
          onlyImageId={
            imageIdsByType[activePicker].length === 1 &&
            isOnlyCategory(activePicker, durationSecondsByType)
              ? imageIdsByType[activePicker][0]
              : null
          }
          onToggleOnly={(id) => toggleOnlyImage(activePicker, id)}
          onClose={() => setActivePicker(null)}
        />
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete screen"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
