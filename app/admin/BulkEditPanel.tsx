"use client";

import { useState } from "react";
import { IMAGE_TYPE_LABELS, IMAGE_TYPES, type ImageType, type Screen } from "@/lib/types";

// Every field is optional -- only ones actually filled in get applied, so
// this can change just one setting (e.g. menu duration) across every screen
// without touching anything else about them.
interface BulkFields {
  perImageDurationSeconds: string;
  durationSecondsByType: Record<ImageType, string>;
}

const EMPTY_FIELDS: BulkFields = {
  perImageDurationSeconds: "",
  durationSecondsByType: { menu: "", food: "", location: "", promo: "" },
};

export default function BulkEditPanel({
  screens,
  onApplied,
}: {
  screens: Screen[];
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(screens.map((s) => s.id)));
  const [fields, setFields] = useState<BulkFields>(EMPTY_FIELDS);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleScreen(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((prev) => (prev.size === screens.length ? new Set() : new Set(screens.map((s) => s.id))));
  }

  const hasAnyValue =
    fields.perImageDurationSeconds.trim() !== "" ||
    IMAGE_TYPES.some((type) => fields.durationSecondsByType[type].trim() !== "");

  async function applyToSelected() {
    setMessage(null);
    if (selectedIds.size === 0) {
      setMessage("Select at least one screen.");
      return;
    }
    if (!hasAnyValue) {
      setMessage("Fill in at least one field to apply.");
      return;
    }

    const body: Record<string, unknown> = {};
    if (fields.perImageDurationSeconds.trim() !== "") {
      body.perImageDurationSeconds = Number(fields.perImageDurationSeconds);
    }
    const durationSecondsByType: Record<string, number> = {};
    for (const type of IMAGE_TYPES) {
      const raw = fields.durationSecondsByType[type].trim();
      if (raw !== "") durationSecondsByType[type] = Number(raw);
    }
    setApplying(true);
    try {
      const results = await Promise.all(
        screens
          .filter((screen) => selectedIds.has(screen.id))
          .map(async (screen) => {
            const perScreenBody = { ...body } as Record<string, unknown>;
            if (Object.keys(durationSecondsByType).length > 0) {
              // The screens/[id] PUT replaces durationSecondsByType wholesale
              // when present, so this screen's untouched categories need to
              // be carried forward rather than defaulted away.
              perScreenBody.durationSecondsByType = {
                ...screen.durationSecondsByType,
                ...durationSecondsByType,
              };
            }
            const res = await fetch(`/api/admin/screens/${screen.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(perScreenBody),
            });
            return res.ok;
          })
      );
      const succeeded = results.filter(Boolean).length;
      setMessage(
        succeeded === results.length
          ? `Updated ${succeeded} screen${succeeded === 1 ? "" : "s"}.`
          : `Updated ${succeeded} of ${results.length} -- some failed, try again.`
      );
      setFields(EMPTY_FIELDS);
      onApplied();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center justify-between text-left"
      >
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Bulk edit screens
        </span>
        <span className="text-sm text-zinc-500">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>

      {open && (
        <>
          <p className="text-xs text-zinc-500">
            Apply a setting to multiple screens at once. Leave a field blank to leave that setting
            alone on every screen.
          </p>

          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={selectedIds.size === screens.length && screens.length > 0}
                onChange={toggleAll}
              />
              All screens
            </label>
            {screens.map((screen) => (
              <label
                key={screen.id}
                className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(screen.id)}
                  onChange={() => toggleScreen(screen.id)}
                />
                {screen.name}
              </label>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Per-image duration (s)
              <input
                type="number"
                min={1}
                placeholder="unchanged"
                value={fields.perImageDurationSeconds}
                onChange={(e) => setFields((prev) => ({ ...prev, perImageDurationSeconds: e.target.value }))}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
              />
            </label>
            {IMAGE_TYPES.map((type) => (
              <label
                key={type}
                className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                {IMAGE_TYPE_LABELS[type]} duration (s)
                <input
                  type="number"
                  min={0}
                  placeholder="unchanged"
                  value={fields.durationSecondsByType[type]}
                  onChange={(e) =>
                    setFields((prev) => ({
                      ...prev,
                      durationSecondsByType: { ...prev.durationSecondsByType, [type]: e.target.value },
                    }))
                  }
                  className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={applyToSelected}
              disabled={applying}
              className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
            >
              {applying ? "Applying…" : `Apply to ${selectedIds.size} screen${selectedIds.size === 1 ? "" : "s"}`}
            </button>
            {message && <p className="text-sm text-zinc-500">{message}</p>}
          </div>
        </>
      )}
    </div>
  );
}
