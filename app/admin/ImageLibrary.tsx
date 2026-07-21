"use client";

import { useRef, useState } from "react";
import { IMAGE_TYPE_LABELS, IMAGE_TYPES, type ImageRecord, type ImageType } from "@/lib/types";

export default function ImageLibrary({
  images,
  onChanged,
}: {
  images: ImageRecord[];
  onChanged: () => void;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function labelValue(image: ImageRecord): string {
    return labelDrafts[image.id] ?? image.label;
  }

  async function saveLabel(image: ImageRecord) {
    const value = labelValue(image).trim();
    if (value === image.label) return;
    setSavingId(image.id);
    try {
      const res = await fetch(`/api/admin/images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: value }),
      });
      if (res.ok) onChanged();
    } finally {
      setSavingId(null);
    }
  }

  async function saveType(image: ImageRecord, type: ImageType) {
    setSavingId(image.id);
    try {
      const res = await fetch(`/api/admin/images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (res.ok) onChanged();
    } finally {
      setSavingId(null);
    }
  }

  async function replaceImage(image: ImageRecord, file: File) {
    setReplacingId(image.id);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const res = await fetch(`/api/admin/images/${image.id}`, {
        method: "PATCH",
        body: formData,
      });
      if (res.ok) onChanged();
    } finally {
      setReplacingId(null);
    }
  }

  async function handleDelete(image: ImageRecord) {
    const label = image.label || "this image";
    if (!window.confirm(`Delete ${label}? This also removes it from any screens using it.`)) {
      return;
    }
    setDeletingId(image.id);
    try {
      const res = await fetch(`/api/admin/images/${image.id}`, { method: "DELETE" });
      if (res.ok) onChanged();
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
            <button
              type="button"
              onClick={() => fileInputRefs.current[image.id]?.click()}
              disabled={replacingId === image.id}
              className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white hover:bg-black/90 disabled:opacity-50"
            >
              {replacingId === image.id ? "Replacing…" : "Replace"}
            </button>
            <input
              ref={(el) => {
                fileInputRefs.current[image.id] = el;
              }}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) replaceImage(image, file);
              }}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2 p-2.5">
            <input
              type="text"
              value={labelValue(image)}
              onChange={(e) =>
                setLabelDrafts((prev) => ({ ...prev, [image.id]: e.target.value }))
              }
              onBlur={() => saveLabel(image)}
              placeholder="untitled"
              disabled={savingId === image.id}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500 disabled:opacity-50"
            />
            <select
              value={image.type}
              onChange={(e) => saveType(image, e.target.value as ImageType)}
              disabled={savingId === image.id}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-xs outline-none focus:border-zinc-500 disabled:opacity-50"
            >
              {IMAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {IMAGE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
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
