"use client";

import { IMAGE_TYPE_LABELS, IMAGE_TYPES, type ImageRecord, type ImageType, type ScheduleRule } from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort();
}

export default function ScheduleEditor({
  rules,
  onChange,
  imageIdsByType,
  images,
}: {
  rules: ScheduleRule[];
  onChange: (rules: ScheduleRule[]) => void;
  imageIdsByType: Record<ImageType, string[]>;
  images: ImageRecord[];
}) {
  const imageById = new Map(images.map((img) => [img.id, img]));

  function addRule() {
    const rule: ScheduleRule = {
      id: crypto.randomUUID(),
      label: "",
      startTime: "06:00",
      endTime: "11:00",
      days: [],
      type: IMAGE_TYPES[0],
    };
    onChange([...rules, rule]);
  }

  function updateRule(id: string, patch: Partial<ScheduleRule>) {
    onChange(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  }

  function removeRule(id: string) {
    onChange(rules.filter((rule) => rule.id !== id));
  }

  const inputClass =
    "rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-zinc-500">
        Automatically switch this screen to just one category (or one image) during a time
        window -- the same effect as an &quot;Only&quot; checkbox, just on autopilot. Outside any
        window below, the screen shows its normal setup above. If windows overlap, the first
        matching rule in this list wins.
      </p>

      {rules.length === 0 && <p className="text-sm text-zinc-500">No schedule rules yet.</p>}

      <div className="flex flex-col gap-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={rule.label}
                onChange={(e) => updateRule(rule.id, { label: e.target.value })}
                placeholder="e.g. Breakfast"
                className={`${inputClass} flex-1 min-w-[120px]`}
              />
              <input
                type="time"
                value={rule.startTime}
                onChange={(e) => updateRule(rule.id, { startTime: e.target.value })}
                className={inputClass}
              />
              <span className="text-xs text-zinc-500">to</span>
              <input
                type="time"
                value={rule.endTime}
                onChange={(e) => updateRule(rule.id, { endTime: e.target.value })}
                className={inputClass}
              />
              <select
                value={rule.type}
                onChange={(e) =>
                  updateRule(rule.id, { type: e.target.value as ImageType, imageId: undefined })
                }
                className={inputClass}
              >
                {IMAGE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {IMAGE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
              <select
                value={rule.imageId ?? ""}
                onChange={(e) => updateRule(rule.id, { imageId: e.target.value || undefined })}
                className={inputClass}
              >
                <option value="">Whole category</option>
                {imageIdsByType[rule.type].map((id) => (
                  <option key={id} value={id}>
                    {imageById.get(id)?.label || id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRule(rule.id)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">Days:</span>
              {DAY_LABELS.map((label, day) => (
                <label key={day} className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={rule.days.includes(day)}
                    onChange={() => updateRule(rule.id, { days: toggleDay(rule.days, day) })}
                  />
                  {label}
                </label>
              ))}
              <span className="text-[11px] text-zinc-400">(none checked = every day)</span>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRule}
        className="self-start rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        Add schedule rule
      </button>
    </div>
  );
}
