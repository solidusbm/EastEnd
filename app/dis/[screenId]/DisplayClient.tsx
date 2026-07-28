"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IMAGE_TYPES, type ImageRecord, type ImageType, type PipConfig, type Screen, type TimingMode } from "@/lib/types";
import { hexToRgba, LABEL_FONT_CSS_VARS, type LabelStyle } from "@/lib/labelStyle";
import { LABEL_FONT_VARIABLES } from "../fonts";

interface DisplayOverride {
  active: true;
  message?: string;
  imageUrl: string | null;
}

interface DisplayData {
  screen: Screen;
  imagesByType: Record<ImageType, ImageRecord[]>;
  playlistImages: ImageRecord[];
  pipImagesByType: Record<ImageType, ImageRecord[]>;
  pipPlaylistImages: ImageRecord[];
  labelStyle: LabelStyle;
  scheduleActive: boolean;
  emergencyOverride: DisplayOverride | null;
}

interface CycleState {
  type: ImageType;
  index: number;
  /** Seconds since this category started -- governs moving to the next category. */
  categoryElapsed: number;
  /** Seconds since the current image started showing -- governs advancing to the next image. */
  imageElapsed: number;
}

const INITIAL_CYCLE: CycleState = { type: IMAGE_TYPES[0], index: 0, categoryElapsed: 0, imageElapsed: 0 };

const POLL_INTERVAL_MS = 45_000;

/**
 * Everything the cycle-advancing logic below needs, abstracted so the exact
 * same code can drive either the main rotation or the independent
 * picture-in-picture overlay rotation -- they're each just a differently
 * sourced "rotation," see toMainSource/toPipSource.
 */
interface RotationSource {
  imagesByType: Record<ImageType, ImageRecord[]>;
  playlistImages: ImageRecord[];
  durationSecondsByType: Record<ImageType, number>;
  perImageDurationSeconds: number;
  imageDurationOverrides: Record<string, number>;
  timingMode: TimingMode;
  playlistMode: boolean;
}

function toMainSource(data: DisplayData): RotationSource {
  return {
    imagesByType: data.imagesByType,
    playlistImages: data.playlistImages,
    durationSecondsByType: data.screen.durationSecondsByType,
    perImageDurationSeconds: data.screen.perImageDurationSeconds,
    imageDurationOverrides: data.screen.imageDurationOverrides,
    timingMode: data.screen.timingMode,
    // Fine-grain mode plays the flat, manually ordered playlist instead of
    // cycling categories -- but a schedule rule is a temporary
    // single-category takeover regardless of timingMode, so it always wins
    // while active. Falls back to category mode if the playlist is empty.
    playlistMode: data.screen.timingMode === "fineGrain" && !data.scheduleActive && data.playlistImages.length > 0,
  };
}

// null when pip isn't enabled -- callers treat that as "nothing to advance/show."
function toPipSource(data: DisplayData): RotationSource | null {
  if (!data.screen.pip.enabled) return null;
  return {
    imagesByType: data.pipImagesByType,
    playlistImages: data.pipPlaylistImages,
    durationSecondsByType: data.screen.pip.durationSecondsByType,
    perImageDurationSeconds: data.screen.pip.perImageDurationSeconds,
    imageDurationOverrides: data.screen.pip.imageDurationOverrides,
    timingMode: data.screen.pip.timingMode,
    playlistMode: data.screen.pip.timingMode === "fineGrain" && data.pipPlaylistImages.length > 0,
  };
}

function isAvailable(type: ImageType, source: RotationSource): boolean {
  return source.imagesByType[type].length > 0 && source.durationSecondsByType[type] > 0;
}

// Walks the category order starting just after `from`, wrapping all the way
// back around to `from` itself if it's the only available category.
function nextAvailableType(from: ImageType, source: RotationSource): ImageType | null {
  const startIndex = IMAGE_TYPES.indexOf(from);
  for (let offset = 1; offset <= IMAGE_TYPES.length; offset++) {
    const type = IMAGE_TYPES[(startIndex + offset) % IMAGE_TYPES.length];
    if (isAvailable(type, source)) return type;
  }
  return null;
}

// Advances a rotation's cycle state by one second. Shared by the main
// rotation and the pip overlay -- pass `null` (nothing to advance, e.g. pip
// disabled or no data yet) to get `prev` back unchanged.
function advanceCycle(prev: CycleState, source: RotationSource | null): CycleState {
  if (!source) return prev;

  if (source.playlistMode) {
    const images = source.playlistImages;
    if (images.length === 0) return prev;
    const currentImageId = images[prev.index % images.length]?.id;
    const perImageDuration = Math.max(
      1,
      (currentImageId && source.imageDurationOverrides[currentImageId]) || source.perImageDurationSeconds
    );
    const imageElapsed = prev.imageElapsed + 1;
    if (images.length > 1 && imageElapsed >= perImageDuration) {
      return { ...prev, imageElapsed: 0, index: (prev.index + 1) % images.length };
    }
    return { ...prev, imageElapsed };
  }

  if (!IMAGE_TYPES.some((type) => isAvailable(type, source))) return prev;

  const type = prev.type;
  if (!isAvailable(type, source)) {
    const next = nextAvailableType(type, source);
    return next ? { type: next, index: 0, categoryElapsed: 0, imageElapsed: 0 } : prev;
  }

  const images = source.imagesByType[type];
  const modeDuration = source.durationSecondsByType[type];

  const categoryElapsed = prev.categoryElapsed + 1;
  if (categoryElapsed >= modeDuration) {
    const next = nextAvailableType(type, source) ?? type;
    return { type: next, index: 0, categoryElapsed: 0, imageElapsed: 0 };
  }

  const currentImageId = images[prev.index % images.length]?.id;
  const perImageDuration = Math.max(
    1,
    (currentImageId && source.imageDurationOverrides[currentImageId]) || source.perImageDurationSeconds
  );

  const imageElapsed = prev.imageElapsed + 1;
  if (images.length > 1 && imageElapsed >= perImageDuration) {
    return { type, categoryElapsed, imageElapsed: 0, index: (prev.index + 1) % images.length };
  }
  return { type, categoryElapsed, imageElapsed, index: prev.index };
}

/** Resolves a rotation source's current image, or null if it has nothing to show. */
function currentImageOf(source: RotationSource | null, cycle: CycleState): ImageRecord | null {
  if (!source) return null;
  const images = source.playlistMode ? source.playlistImages : source.imagesByType[cycle.type];
  if (images.length === 0) return null;
  return images[cycle.index % images.length] ?? null;
}

// A small fixed inset off the screen edge for the four corner presets --
// "custom" placement uses pip.offsetX/offsetY instead, anchored top-left.
const PIP_CORNER_INSET = "1rem";

function pipStyle(pip: PipConfig): CSSProperties {
  const style: CSSProperties = {
    width: pip.sizeUnit === "pixels" ? `${pip.sizeValue}px` : `${pip.sizeValue}%`,
  };
  if (pip.placementMode === "custom") {
    style.left = pip.offsetXUnit === "pixels" ? `${pip.offsetXValue}px` : `${pip.offsetXValue}%`;
    style.top = pip.offsetYUnit === "pixels" ? `${pip.offsetYValue}px` : `${pip.offsetYValue}%`;
  } else {
    if (pip.position.startsWith("top")) style.top = PIP_CORNER_INSET;
    else style.bottom = PIP_CORNER_INSET;
    if (pip.position.endsWith("left")) style.left = PIP_CORNER_INSET;
    else style.right = PIP_CORNER_INSET;
  }
  return style;
}

// The pip overlay's caption uses the same configured style, just scaled
// down -- the box itself is much smaller than the main display.
const PIP_CAPTION_SCALE = 0.55;

function captionStyle(labelStyle: LabelStyle, scale: number): CSSProperties {
  return {
    fontSize: `${Math.round(labelStyle.fontSize * scale)}px`,
    color: labelStyle.textColor,
    backgroundColor: hexToRgba(labelStyle.backgroundColor, labelStyle.backgroundOpacity),
    fontFamily: LABEL_FONT_CSS_VARS[labelStyle.fontFamily],
  };
}

export default function DisplayClient({ screenId }: { screenId: string }) {
  const [data, setData] = useState<DisplayData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const dataRef = useRef<DisplayData | null>(null);

  const [cycle, setCycle] = useState<CycleState>(INITIAL_CYCLE);
  const [pipCycle, setPipCycle] = useState<CycleState>(INITIAL_CYCLE);

  const [layers, setLayers] = useState<[string | null, string | null]>([null, null]);
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Hide any scrollbars/chrome for TV displays.
  useEffect(() => {
    const original = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = original;
    };
  }, []);

  // Poll the screen config so content updates propagate without a manual reload.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/display/${screenId}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) return;
        const json = (await res.json()) as DisplayData;
        if (!cancelled) {
          setData(json);
          setNotFound(false);
        }
      } catch {
        // Transient network error: keep showing the last known content.
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [screenId]);

  // Advance both the main rotation and the pip overlay's rotation once per second.
  useEffect(() => {
    const interval = setInterval(() => {
      setCycle((prev) => advanceCycle(prev, dataRef.current ? toMainSource(dataRef.current) : null));
      setPipCycle((prev) => advanceCycle(prev, dataRef.current ? toPipSource(dataRef.current) : null));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mainSource = data ? toMainSource(data) : null;
  const currentImage = currentImageOf(mainSource, cycle);
  const currentUrl = currentImage?.url ?? null;
  const currentLabel = currentImage?.showLabel && currentImage.label ? currentImage.label : null;

  const pipSource = data ? toPipSource(data) : null;
  const pipImage = currentImageOf(pipSource, pipCycle);
  const pipUrl = pipImage?.url ?? null;
  const pipLabel = pipImage?.showLabel && pipImage.label ? pipImage.label : null;

  // Crossfade between the previous and next image using two stacked layers.
  // Adjusting state during render (guarded by lastUrlRef) rather than in an
  // effect avoids an extra flash-of-old-image render before the swap commits.
  if (currentUrl && currentUrl !== lastUrl) {
    setLastUrl(currentUrl);
    const nextActive: 0 | 1 = activeLayer === 0 ? 1 : 0;
    setLayers((prevLayers) => {
      const next: [string | null, string | null] = [...prevLayers];
      next[nextActive] = currentUrl;
      return next;
    });
    setActiveLayer(nextActive);
  }

  if (notFound) {
    return (
      <Placeholder
        title="Screen not configured"
        subtitle={`No screen with id "${screenId}" exists yet. Create it in /admin.`}
      />
    );
  }

  if (!data) {
    return <Placeholder title="Loading…" subtitle="" />;
  }

  if (data.emergencyOverride) {
    return <EmergencyOverrideView override={data.emergencyOverride} />;
  }

  if (!currentUrl) {
    return (
      <Placeholder
        title={data.screen.name}
        subtitle={
          data.screen.timingMode === "fineGrain"
            ? "No images in the playlist yet. Add some in /admin."
            : "No images assigned to this screen yet. Add some in /admin."
        }
      />
    );
  }

  return (
    <div className={`fixed inset-0 overflow-hidden bg-black ${LABEL_FONT_VARIABLES}`}>
      {[0, 1].map((layerIndex) => {
        const src = layers[layerIndex];
        if (!src) return null;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={layerIndex}
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-contain transition-opacity duration-1000 ease-in-out"
            style={{ opacity: activeLayer === layerIndex ? 1 : 0 }}
          />
        );
      })}
      {currentLabel && (
        <div
          className="absolute inset-x-0 bottom-0 px-6 py-3 text-center"
          style={captionStyle(data.labelStyle, 1)}
        >
          <p className="font-medium">{currentLabel}</p>
        </div>
      )}
      {pipUrl && (
        <div
          className="absolute overflow-hidden rounded-lg border-2 border-white/80 bg-black shadow-2xl"
          style={pipStyle(data.screen.pip)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pipUrl} alt="" className="aspect-video w-full object-contain" />
          {pipLabel && (
            <div
              className="absolute inset-x-0 bottom-0 px-2 py-1 text-center"
              style={captionStyle(data.labelStyle, PIP_CAPTION_SCALE)}
            >
              <p className="truncate font-medium">{pipLabel}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmergencyOverrideView({ override }: { override: DisplayOverride }) {
  if (override.imageUrl) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={override.imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
        {override.message && (
          <div className="absolute inset-x-0 bottom-0 bg-black/80 px-8 py-6 text-center">
            <p className="text-2xl font-semibold text-white">{override.message}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-black px-8 text-center">
      <p className="max-w-3xl text-4xl font-semibold text-white">{override.message}</p>
    </div>
  );
}

function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-black px-8 text-center">
      <p className="text-2xl font-semibold text-zinc-300">{title}</p>
      {subtitle && <p className="max-w-lg text-sm text-zinc-500">{subtitle}</p>}
    </div>
  );
}
