"use client";

import { useRef, useState, type FormEvent } from "react";
import { IMAGE_TYPE_LABELS, IMAGE_TYPES, type ImageType } from "@/lib/types";

type Mode = "file" | "canva";

export default function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("file");
  const [canvaUrl, setCanvaUrl] = useState("");
  const [type, setType] = useState<ImageType>(IMAGE_TYPES[0]);
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "canva") {
      if (canvaUrl.trim().length === 0) {
        setError("Paste a Canva design URL first.");
        return;
      }
      setUploading(true);
      try {
        const res = await fetch("/api/admin/canva/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: canvaUrl, type, label }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Import failed.");
          return;
        }
        setCanvaUrl("");
        setLabel("");
        onUploaded();
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setUploading(false);
      }
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose an image file first.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("type", type);
      formData.set("label", label);

      const res = await fetch("/api/admin/images", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }

      setLabel("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploaded();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"
    >
      <div className="flex gap-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={mode === "file"}
            onChange={() => setMode("file")}
          />
          Upload file
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={mode === "canva"}
            onChange={() => setMode("canva")}
          />
          Import from Canva
        </label>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
        {mode === "file" ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Image</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="text-sm text-zinc-600 dark:text-zinc-400"
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Canva design URL
            </label>
            <input
              type="text"
              value={canvaUrl}
              onChange={(e) => setCanvaUrl(e.target.value)}
              placeholder="https://www.canva.com/design/..."
              className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ImageType)}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 px-2 py-1.5 text-sm"
          >
            {IMAGE_TYPES.map((t) => (
              <option key={t} value={t}>
                {IMAGE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col gap-1">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Label (optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Lunch Menu v2"
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
        >
          {uploading ? (mode === "canva" ? "Importing…" : "Uploading…") : mode === "canva" ? "Import" : "Upload"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
