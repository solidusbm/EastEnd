"use client";

import { useEffect, useRef, useState } from "react";
import { IMAGE_TYPES, type ImageRecord, type ImageType, type Screen } from "@/lib/types";

interface DisplayOverride {
  active: true;
  message?: string;
  imageUrl: string | null;
}

interface DisplayData {
  screen: Screen;
  imagesByType: Record<ImageType, ImageRecord[]>;
  emergencyOverride: DisplayOverride | null;
}

interface CycleState {
  type: ImageType;
  index: number;
  elapsed: number;
}

const POLL_INTERVAL_MS = 45_000;

function isAvailable(type: ImageType, data: DisplayData): boolean {
  return data.imagesByType[type].length > 0 && data.screen.durationSecondsByType[type] > 0;
}

// Walks the category order starting just after `from`, wrapping all the way
// back around to `from` itself if it's the only available category.
function nextAvailableType(from: ImageType, data: DisplayData): ImageType | null {
  const startIndex = IMAGE_TYPES.indexOf(from);
  for (let offset = 1; offset <= IMAGE_TYPES.length; offset++) {
    const type = IMAGE_TYPES[(startIndex + offset) % IMAGE_TYPES.length];
    if (isAvailable(type, data)) return type;
  }
  return null;
}

export default function DisplayClient({ screenId }: { screenId: string }) {
  const [data, setData] = useState<DisplayData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const dataRef = useRef<DisplayData | null>(null);

  const [cycle, setCycle] = useState<CycleState>({ type: IMAGE_TYPES[0], index: 0, elapsed: 0 });

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

  // Advance the category cycle and per-image rotation once per second.
  useEffect(() => {
    const interval = setInterval(() => {
      setCycle((prev) => {
        const current = dataRef.current;
        if (!current) return prev;

        if (!IMAGE_TYPES.some((type) => isAvailable(type, current))) return prev;

        const type = prev.type;
        if (!isAvailable(type, current)) {
          const next = nextAvailableType(type, current);
          return next ? { type: next, index: 0, elapsed: 0 } : prev;
        }

        const images = current.imagesByType[type];
        const modeDuration = current.screen.durationSecondsByType[type];
        const perImageDuration = Math.max(1, current.screen.perImageDurationSeconds);

        const elapsed = prev.elapsed + 1;
        if (elapsed >= modeDuration) {
          const next = nextAvailableType(type, current) ?? type;
          return { type: next, index: 0, elapsed: 0 };
        }
        if (images.length > 1 && elapsed % perImageDuration === 0) {
          return { type, elapsed, index: (prev.index + 1) % images.length };
        }
        return { type, elapsed, index: prev.index };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentImages = data ? data.imagesByType[cycle.type] : [];
  const safeIndex = currentImages.length > 0 ? cycle.index % currentImages.length : 0;
  const currentUrl = currentImages[safeIndex]?.url ?? null;

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

  if (currentImages.length === 0) {
    return (
      <Placeholder
        title={data.screen.name}
        subtitle="No images assigned to this screen yet. Add some in /admin."
      />
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
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
