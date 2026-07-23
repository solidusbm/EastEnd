"use client";

import { useEffect, useState } from "react";
import type { ImageRecord } from "@/lib/types";
import PreviewLightbox from "./PreviewLightbox";

export default function ImagePickerModal({
  title,
  images,
  selectedIds,
  onToggle,
  onlyImageId,
  onToggleOnly,
  onMove,
  defaultDurationSeconds,
  durationOverrides,
  onDurationChange,
  onClose,
}: {
  title: string;
  images: ImageRecord[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onlyImageId: string | null;
  onToggleOnly: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  defaultDurationSeconds: number;
  durationOverrides: Record<string, number>;
  onDurationChange: (id: string, seconds: number | undefined) => void;
  onClose: () => void;
}) {
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // The lightbox has its own Escape handler when open -- let that close
      // just the lightbox rather than also dismissing this modal underneath it.
      if (event.key === "Escape" && !previewImage) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, previewImage]);

  const imageById = new Map(images.map((image) => [image.id, image]));
  const selectedImages = selectedIds.map((id) => imageById.get(id)).filter((img): img is ImageRecord => Boolean(img));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-xl bg-white dark:bg-zinc-900 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900"
          >
            Done ({selectedIds.length} selected)
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          {selectedImages.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Display order &amp; timing
              </p>
              <ul className="flex flex-col gap-1">
                {selectedImages.map((image, index) => (
                  <li
                    key={image.id}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 px-2 py-1.5"
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => onMove(image.id, "up")}
                        disabled={index === 0}
                        aria-label="Move up"
                        className="leading-none text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => onMove(image.id, "down")}
                        disabled={index === selectedImages.length - 1}
                        aria-label="Move down"
                        className="leading-none text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt=""
                      onClick={() => setPreviewImage(image)}
                      className="h-10 w-16 flex-none cursor-pointer rounded object-cover"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                      {image.label || image.id}
                    </span>
                    <label className="flex items-center gap-1 text-xs text-zinc-500">
                      <input
                        type="number"
                        min={1}
                        placeholder={String(defaultDurationSeconds)}
                        value={durationOverrides[image.id] ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          onDurationChange(image.id, raw === "" ? undefined : Number(raw));
                        }}
                        className="w-16 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-1.5 py-1 text-sm outline-none focus:border-zinc-500"
                      />
                      s
                    </label>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-400">
                Blank duration uses the screen&apos;s default ({defaultDurationSeconds}s).
              </p>
            </div>
          )}

          {images.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No images tagged for this category yet. Upload some above first.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((image) => {
                const selected = selectedIds.includes(image.id);
                return (
                  <div
                    key={image.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onToggle(image.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onToggle(image.id);
                      }
                    }}
                    className={`flex cursor-pointer flex-col overflow-hidden rounded-lg border-2 text-left transition-colors ${
                      selected
                        ? "border-blue-500"
                        : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt={image.label || image.type}
                        className="h-full w-full object-cover"
                      />
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                          ✓
                        </span>
                      )}
                      <label
                        className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white"
                        title="Show only this image on the screen"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={onlyImageId === image.id}
                          onChange={() => onToggleOnly(image.id)}
                          className="h-3 w-3"
                        />
                        Only
                      </label>
                    </div>
                    <span className="truncate px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {image.label || image.id}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <PreviewLightbox image={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
