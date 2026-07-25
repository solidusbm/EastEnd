"use client";

import { useState, type FormEvent } from "react";
import { DEFAULT_SCREEN_DEFAULTS } from "@/lib/types";

export default function NewScreenForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ...DEFAULT_SCREEN_DEFAULTS,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create screen.");
        return;
      }
      setName("");
      onCreated();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-5 sm:flex-row sm:items-end sm:gap-4"
    >
      <div className="flex flex-1 flex-col gap-1">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Display name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bar TV"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-zinc-500"
        />
      </div>

      <button
        type="submit"
        disabled={creating || name.trim().length === 0}
        className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
      >
        {creating ? "Creating…" : "Create screen"}
      </button>

      {error && <p className="text-sm text-red-600 sm:ml-2">{error}</p>}
    </form>
  );
}
