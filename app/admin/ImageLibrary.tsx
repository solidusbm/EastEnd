"use client";

import { useState } from "react";
import type { ImageRecord } from "@/lib/types";

export default function ImageLibrary({
  images,
  onDeleted,
}: {
  images: ImageRecord[];
  onDeleted: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(image: ImageRecord) {
    const label = image.label || "this image";
    if (!window.confirm(`Delete ${label}? This also removes it from any screens using it.`)) {
      return;
    }
    setDeletingId(image.id);
    try {
      const res = await fetch(`/api/admin/images/${image.id}`, { method: "DELETE" });
      if (res.ok) onDeleted();
    } finally {
      setDeletingId(null);
    }
  }

  if (images.length === 0) {
    return <p className="text-sm text-zinc-500">No images uploaded yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {images.map((image) => (
        <div
          key={image.id}
          className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
        >
          <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.label || image.type}
              className="h-full w-full object-cover"
            />
            <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              {image.type}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2 p-2.5">
            <p className="truncate text-sm text-zinc-700 dark:text-zinc-300" title={image.label}>
              {image.label || <span className="italic text-zinc-400">untitled</span>}
            </p>
            <button
              onClick={() => handleDelete(image)}
              disabled={deletingId === image.id}
              className="mt-auto self-start text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              {deletingId === image.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
