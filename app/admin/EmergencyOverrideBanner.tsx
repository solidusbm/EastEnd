"use client";

import { useEffect, useState } from "react";
import { isMotionMedia, isVideoFile } from "@/lib/media";
import type { ImageRecord } from "@/lib/types";

interface EmergencyOverride {
  active: boolean;
  imageId?: string;
  message?: string;
  activatedAt?: string;
}

export default function EmergencyOverrideBanner({ images }: { images: ImageRecord[] }) {
  const [override, setOverride] = useState<EmergencyOverride | null>(null);
  const [message, setMessage] = useState("");
  const [imageId, setImageId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/emergency-override", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setOverride(data.emergencyOverride);
      });
  }, []);

  async function activate() {
    setError(null);
    if (!message.trim() && !imageId) {
      setError("Add a message, pick an image, or both.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/emergency-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true, message: message.trim(), imageId: imageId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not activate the override.");
        return;
      }
      setOverride(data.emergencyOverride);
      setMessage("");
      setImageId("");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deactivate() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/emergency-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      });
      if (res.ok) setOverride({ active: false });
    } finally {
      setSubmitting(false);
    }
  }

  if (override === null) return null;

  if (override.active) {
    const imageLabel = override.imageId ? images.find((img) => img.id === override.imageId)?.label : null;
    return (
      <div className="flex flex-col gap-2 rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">
            Override is LIVE on every screen
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">
            {override.message || imageLabel || "(image, no message)"}
          </p>
        </div>
        <button
          type="button"
          onClick={deactivate}
          disabled={submitting}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? "Deactivating…" : "Deactivate override"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Emergency override</h3>
        <p className="text-sm text-zinc-500">
          Instantly replace every screen&apos;s normal rotation with a message and/or image (e.g.
          &quot;Closed for a private event&quot;). Every TV picks it up within its next poll (up to
          45 seconds). Screens go back to normal the moment you deactivate it.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Closed today for a private event"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 px-2 py-1.5 text-sm outline-none focus:border-zinc-500 sm:col-span-2"
        />
        <select
          value={imageId}
          onChange={(e) => setImageId(e.target.value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
        >
          <option value="">No image</option>
          {images.map((img) => (
            <option key={img.id} value={img.id}>
              {img.label || img.type}
              {isMotionMedia(img.url) ? ` (${isVideoFile(img.url) ? "video" : "GIF"})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={activate}
          disabled={submitting}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? "Activating…" : "Activate override"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
