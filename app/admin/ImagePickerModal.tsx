"use client";

import { useEffect } from "react";
import type { ImageRecord } from "@/lib/types";

export default function ImagePickerModal({
  title,
  images,
  selectedIds,
  onToggle,
  onClose,
}: {
  title: string;
  images: ImageRecord[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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

        <div className="overflow-y-auto">
          {images.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No images tagged for this category yet. Upload some above first.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((image) => {
                const selected = selectedIds.includes(image.id);
                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => onToggle(image.id)}
                    className={`flex flex-col overflow-hidden rounded-lg border-2 text-left transition-colors ${
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
                    </div>
                    <span className="truncate px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {image.label || image.id}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
