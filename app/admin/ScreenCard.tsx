"use client";

import { useState } from "react";
import type { ImageRecord, Screen } from "@/lib/types";

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];
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
  const [menuDurationSeconds, setMenuDurationSeconds] = useState(screen.menuDurationSeconds);
  const [foodDurationSeconds, setFoodDurationSeconds] = useState(screen.foodDurationSeconds);
  const [perImageDurationSeconds, setPerImageDurationSeconds] = useState(
    screen.perImageDurationSeconds
  );
  const [menuImageIds, setMenuImageIds] = useState<string[]>(screen.menuImageIds);
  const [foodImageIds, setFoodImageIds] = useState<string[]>(screen.foodImageIds);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevScreen, setPrevScreen] = useState(screen);
  const displayPath = `/display/${screen.id}`;

  if (prevScreen !== screen) {
    setPrevScreen(screen);
    setName(screen.name);
    setMenuDurationSeconds(screen.menuDurationSeconds);
    setFoodDurationSeconds(screen.foodDurationSeconds);
    setPerImageDurationSeconds(screen.perImageDurationSeconds);
    setMenuImageIds(screen.menuImageIds);
    setFoodImageIds(screen.foodImageIds);
  }

  const menuImages = images.filter((image) => image.type === "menu");
  const foodImages = images.filter((image) => image.type === "food");

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/screens/${screen.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          menuDurationSeconds,
          foodDurationSeconds,
          perImageDurationSeconds,
          menuImageIds,
          foodImageIds,
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

      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Menu duration (s)
          <input
            type="number"
            min={1}
            value={menuDurationSeconds}
            onChange={(e) => setMenuDurationSeconds(Number(e.target.value))}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Food duration (s)
          <input
            type="number"
            min={1}
            value={foodDurationSeconds}
            onChange={(e) => setFoodDurationSeconds(Number(e.target.value))}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Per-image duration (s)
          <input
            type="number"
            min={1}
            value={perImageDurationSeconds}
            onChange={(e) => setPerImageDurationSeconds(Number(e.target.value))}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Menu images ({menuImageIds.length})
          </p>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800 p-2">
            {menuImages.length === 0 && (
              <p className="text-xs text-zinc-400">No menu-tagged images uploaded yet.</p>
            )}
            {menuImages.map((image) => (
              <label key={image.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={menuImageIds.includes(image.id)}
                  onChange={() => setMenuImageIds((ids) => toggleId(ids, image.id))}
                />
                <span className="truncate">{image.label || image.id}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Food images ({foodImageIds.length})
          </p>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-800 p-2">
            {foodImages.length === 0 && (
              <p className="text-xs text-zinc-400">No food-tagged images uploaded yet.</p>
            )}
            {foodImages.map((image) => (
              <label key={image.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={foodImageIds.includes(image.id)}
                  onChange={() => setFoodImageIds((ids) => toggleId(ids, image.id))}
                />
                <span className="truncate">{image.label || image.id}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

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
