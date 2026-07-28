"use client";

import { useState } from "react";
import {
  IMAGE_TYPE_LABELS,
  IMAGE_TYPES,
  PIP_OFFSET_UNIT_LABELS,
  PIP_POSITIONS,
  PIP_POSITION_LABELS,
  PIP_SIZE_UNITS,
  PIP_SIZE_UNIT_LABELS,
  type ImageRecord,
  type ImageType,
  type PipConfig,
  type PipPosition,
  type PipSizeUnit,
  type SavedPlaylist,
  type Screen,
  type TimingMode,
} from "@/lib/types";
import ScheduleEditor from "./ScheduleEditor";
import TimingModeEditor from "./TimingModeEditor";

// TVs poll /api/display/[screenId] every 45s, so allow a couple of missed
// polls before flagging a screen as stale rather than reacting to it
// instantly (a single dropped request shouldn't read as "the TV is off").
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function getScreenStatus(lastSeenAt?: string): {
  tone: "online" | "stale" | "unknown";
  label: string;
} {
  if (!lastSeenAt) return { tone: "unknown", label: "Never connected" };
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  if (ageMs < ONLINE_THRESHOLD_MS) return { tone: "online", label: "Online" };
  const minutes = Math.round(ageMs / 60_000);
  if (minutes < 60) return { tone: "stale", label: `Last seen ${minutes}m ago` };
  const hours = Math.round(minutes / 60);
  return { tone: "stale", label: `Last seen ${hours}h ago` };
}

const STATUS_DOT_CLASS: Record<"online" | "stale" | "unknown", string> = {
  online: "bg-green-500",
  stale: "bg-red-500",
  unknown: "bg-zinc-400",
};

// A category is "the only one" when it has a nonzero duration and every
// other category is silenced (duration 0), matching how DisplayClient
// decides a category is unavailable.
function isOnlyCategory(type: ImageType, durations: Record<ImageType, number>): boolean {
  return durations[type] > 0 && IMAGE_TYPES.every((t) => t === type || durations[t] === 0);
}

export default function ScreenCard({
  screen,
  images,
  savedPlaylists,
  onUpdated,
  onDeleted,
  onPlaylistsChanged,
  onImagesChanged,
}: {
  screen: Screen;
  images: ImageRecord[];
  savedPlaylists: SavedPlaylist[];
  onUpdated: () => void;
  onDeleted: () => void;
  onPlaylistsChanged: () => void;
  onImagesChanged: () => void;
}) {
  const [name, setName] = useState(screen.name);
  const [durationSecondsByType, setDurationSecondsByType] = useState(screen.durationSecondsByType);
  const [perImageDurationSeconds, setPerImageDurationSeconds] = useState(
    screen.perImageDurationSeconds
  );
  const [imageIdsByType, setImageIdsByType] = useState(screen.imageIdsByType);
  const [imageDurationOverrides, setImageDurationOverrides] = useState(screen.imageDurationOverrides);
  const [timingMode, setTimingMode] = useState<TimingMode>(screen.timingMode);
  const [playlist, setPlaylist] = useState(screen.playlist);
  const [pip, setPip] = useState<PipConfig>(screen.pip);
  const [scheduleRules, setScheduleRules] = useState(screen.scheduleRules);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prevScreen, setPrevScreen] = useState(screen);
  // The dashboard refreshes screen data in the background (after any save,
  // and periodically for online/offline status) -- without this, that
  // refresh would silently overwrite whatever the user is mid-edit on here
  // with whatever's still saved on the server.
  const [dirty, setDirty] = useState(false);
  const displayPath = `/dis/${screen.id}`;

  if (prevScreen !== screen) {
    setPrevScreen(screen);
    if (!dirty) {
      setName(screen.name);
      setDurationSecondsByType(screen.durationSecondsByType);
      setPerImageDurationSeconds(screen.perImageDurationSeconds);
      setImageIdsByType(screen.imageIdsByType);
      setImageDurationOverrides(screen.imageDurationOverrides);
      setTimingMode(screen.timingMode);
      setPlaylist(screen.playlist);
      setPip(screen.pip);
      setScheduleRules(screen.scheduleRules);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/screens/${screen.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          durationSecondsByType,
          perImageDurationSeconds,
          imageIdsByType,
          imageDurationOverrides,
          timingMode,
          playlist,
          pip,
          scheduleRules,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not save screen.");
        return;
      }
      setDirty(false);
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

  const status = getScreenStatus(screen.lastSeenAt);
  const totalImages = IMAGE_TYPES.reduce((sum, type) => sum + imageIdsByType[type].length, 0);
  const onlyType = IMAGE_TYPES.find((type) => isOnlyCategory(type, durationSecondsByType));
  const summary =
    (timingMode === "fineGrain"
      ? `Fine-grain playlist · ${playlist.length} image${playlist.length === 1 ? "" : "s"}`
      : onlyType
        ? `Only ${IMAGE_TYPE_LABELS[onlyType]} · ${imageIdsByType[onlyType].length} image${imageIdsByType[onlyType].length === 1 ? "" : "s"}`
        : `${totalImages} image${totalImages === 1 ? "" : "s"} across categories`) +
    (pip.enabled ? " · PiP on" : "");

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
            onChange={(e) => {
              setDirty(true);
              setName(e.target.value);
            }}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm font-medium outline-none focus:border-zinc-500"
          />
          <span className="text-xs text-zinc-400">id: {screen.id}</span>
          <span
            className="flex items-center gap-1.5 text-xs text-zinc-500"
            title={screen.lastSeenAt ? new Date(screen.lastSeenAt).toLocaleString() : undefined}
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS[status.tone]}`} />
            {status.label}
          </span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <a
            href={displayPath}
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

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {collapsed ? "Show ▼" : "Hide ▲"}
        </button>
      </div>

      {collapsed && <p className="text-xs text-zinc-500">{summary}</p>}

      {!collapsed && (
        <>
          <TimingModeEditor
            images={images}
            savedPlaylists={savedPlaylists}
            onPlaylistsChanged={onPlaylistsChanged}
            onImagesChanged={onImagesChanged}
            timingMode={timingMode}
            onTimingModeChange={(mode) => {
              setDirty(true);
              setTimingMode(mode);
            }}
            imageIdsByType={imageIdsByType}
            onImageIdsByTypeChange={(fn) => {
              setDirty(true);
              setImageIdsByType(fn);
            }}
            durationSecondsByType={durationSecondsByType}
            onDurationSecondsByTypeChange={(fn) => {
              setDirty(true);
              setDurationSecondsByType(fn);
            }}
            perImageDurationSeconds={perImageDurationSeconds}
            onPerImageDurationSecondsChange={(seconds) => {
              setDirty(true);
              setPerImageDurationSeconds(seconds);
            }}
            playlist={playlist}
            onPlaylistChange={(fn) => {
              setDirty(true);
              setPlaylist(fn);
            }}
            imageDurationOverrides={imageDurationOverrides}
            onImageDurationOverridesChange={(fn) => {
              setDirty(true);
              setImageDurationOverrides(fn);
            }}
          />

          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <div className="flex items-center justify-between gap-2">
              <label
                className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500"
                title="Overlay an independent second rotation in a corner, on top of the rotation above -- its own timing, own images."
              >
                <input
                  type="checkbox"
                  checked={pip.enabled}
                  onChange={() => {
                    setDirty(true);
                    setPip((prev) => ({ ...prev, enabled: !prev.enabled }));
                  }}
                />
                Picture-in-picture
              </label>
              <button
                type="button"
                onClick={() => setPipOpen((value) => !value)}
                className="text-xs text-zinc-500"
              >
                {pipOpen ? "Hide ▲" : "Show ▼"}
              </button>
            </div>
            {pipOpen && (
              <>
                <p className="text-[11px] text-zinc-400">
                  Its own independent rotation, shown in a corner on top of the rotation above --
                  configure its timing/images the same way.
                </p>
                {pip.enabled && (
                  <div className="flex flex-col gap-3 rounded-md border border-zinc-200 dark:border-zinc-800 p-2">
                    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      Size
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          value={pip.sizeValue}
                          onChange={(e) => {
                            setDirty(true);
                            setPip((prev) => ({ ...prev, sizeValue: Number(e.target.value) }));
                          }}
                          className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
                        />
                        <select
                          value={pip.sizeUnit}
                          onChange={(e) => {
                            setDirty(true);
                            setPip((prev) => ({ ...prev, sizeUnit: e.target.value as PipSizeUnit }));
                          }}
                          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 px-2 py-1 text-xs outline-none focus:border-zinc-500"
                        >
                          {PIP_SIZE_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {PIP_SIZE_UNIT_LABELS[u]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Position</p>
                      <div className="flex w-fit items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-700 p-1 text-xs font-medium">
                        <button
                          type="button"
                          onClick={() => {
                            setDirty(true);
                            setPip((prev) => ({ ...prev, placementMode: "corner" }));
                          }}
                          className={`rounded-md px-3 py-1.5 ${
                            pip.placementMode === "corner"
                              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          Corner
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDirty(true);
                            setPip((prev) => ({ ...prev, placementMode: "custom" }));
                          }}
                          className={`rounded-md px-3 py-1.5 ${
                            pip.placementMode === "custom"
                              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                          }`}
                        >
                          Custom
                        </button>
                      </div>

                      {pip.placementMode === "corner" ? (
                        <select
                          value={pip.position}
                          onChange={(e) => {
                            setDirty(true);
                            setPip((prev) => ({ ...prev, position: e.target.value as PipPosition }));
                          }}
                          className="w-fit rounded-md border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 px-2 py-1 text-xs outline-none focus:border-zinc-500"
                        >
                          {PIP_POSITIONS.map((p) => (
                            <option key={p} value={p}>
                              {PIP_POSITION_LABELS[p]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex flex-wrap items-end gap-3">
                          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            From left
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={pip.offsetXValue}
                                onChange={(e) => {
                                  setDirty(true);
                                  setPip((prev) => ({ ...prev, offsetXValue: Number(e.target.value) }));
                                }}
                                className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
                              />
                              <select
                                value={pip.offsetXUnit}
                                onChange={(e) => {
                                  setDirty(true);
                                  setPip((prev) => ({ ...prev, offsetXUnit: e.target.value as PipSizeUnit }));
                                }}
                                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 px-2 py-1 text-xs outline-none focus:border-zinc-500"
                              >
                                {PIP_SIZE_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {PIP_OFFSET_UNIT_LABELS[u]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            From top
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={pip.offsetYValue}
                                onChange={(e) => {
                                  setDirty(true);
                                  setPip((prev) => ({ ...prev, offsetYValue: Number(e.target.value) }));
                                }}
                                className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm outline-none focus:border-zinc-500"
                              />
                              <select
                                value={pip.offsetYUnit}
                                onChange={(e) => {
                                  setDirty(true);
                                  setPip((prev) => ({ ...prev, offsetYUnit: e.target.value as PipSizeUnit }));
                                }}
                                className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 px-2 py-1 text-xs outline-none focus:border-zinc-500"
                              >
                                {PIP_SIZE_UNITS.map((u) => (
                                  <option key={u} value={u}>
                                    {PIP_OFFSET_UNIT_LABELS[u]}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {pip.enabled ? (
                  <TimingModeEditor
                    images={images}
                    savedPlaylists={savedPlaylists}
                    onPlaylistsChanged={onPlaylistsChanged}
                    onImagesChanged={onImagesChanged}
                    timingMode={pip.timingMode}
                    onTimingModeChange={(mode) => {
                      setDirty(true);
                      setPip((prev) => ({ ...prev, timingMode: mode }));
                    }}
                    imageIdsByType={pip.imageIdsByType}
                    onImageIdsByTypeChange={(fn) => {
                      setDirty(true);
                      setPip((prev) => ({ ...prev, imageIdsByType: fn(prev.imageIdsByType) }));
                    }}
                    durationSecondsByType={pip.durationSecondsByType}
                    onDurationSecondsByTypeChange={(fn) => {
                      setDirty(true);
                      setPip((prev) => ({ ...prev, durationSecondsByType: fn(prev.durationSecondsByType) }));
                    }}
                    perImageDurationSeconds={pip.perImageDurationSeconds}
                    onPerImageDurationSecondsChange={(seconds) => {
                      setDirty(true);
                      setPip((prev) => ({ ...prev, perImageDurationSeconds: seconds }));
                    }}
                    playlist={pip.playlist}
                    onPlaylistChange={(fn) => {
                      setDirty(true);
                      setPip((prev) => ({ ...prev, playlist: fn(prev.playlist) }));
                    }}
                    imageDurationOverrides={pip.imageDurationOverrides}
                    onImageDurationOverridesChange={(fn) => {
                      setDirty(true);
                      setPip((prev) => ({ ...prev, imageDurationOverrides: fn(prev.imageDurationOverrides) }));
                    }}
                  />
                ) : (
                  <p className="text-xs text-zinc-500">Enable picture-in-picture above to configure its overlay.</p>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
            <button
              type="button"
              onClick={() => setScheduleOpen((value) => !value)}
              className="flex items-center justify-between text-left"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Schedule {scheduleRules.length > 0 ? `(${scheduleRules.length})` : ""}
              </span>
              <span className="text-xs text-zinc-500">{scheduleOpen ? "Hide ▲" : "Show ▼"}</span>
            </button>
            {scheduleOpen && (
              <ScheduleEditor
                rules={scheduleRules}
                onChange={(rules) => {
                  setDirty(true);
                  setScheduleRules(rules);
                }}
                imageIdsByType={imageIdsByType}
                images={images}
              />
            )}
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
        </>
      )}
    </div>
  );
}
