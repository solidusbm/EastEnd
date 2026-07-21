"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageRecord, Screen } from "@/lib/types";

interface DisplayData {
  screen: Screen;
  menuImages: ImageRecord[];
  foodImages: ImageRecord[];
}

type Mode = "menu" | "food";

interface CycleState {
  mode: Mode;
  index: number;
  elapsed: number;
}

const POLL_INTERVAL_MS = 45_000;

export default function DisplayClient({ screenId }: { screenId: string }) {
  const [data, setData] = useState<DisplayData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const dataRef = useRef<DisplayData | null>(null);

  const [cycle, setCycle] = useState<CycleState>({ mode: "menu", index: 0, elapsed: 0 });

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

  // Advance the menu/food cycle and per-image rotation once per second.
  useEffect(() => {
    const interval = setInterval(() => {
      setCycle((prev) => {
        const current = dataRef.current;
        if (!current) return prev;

        const menuAvailable = current.menuImages.length > 0 && current.screen.menuDurationSeconds > 0;
        const foodAvailable = current.foodImages.length > 0 && current.screen.foodDurationSeconds > 0;
        if (!menuAvailable && !foodAvailable) return prev;

        let mode = prev.mode;
        if (mode === "menu" && !menuAvailable) mode = "food";
        if (mode === "food" && !foodAvailable) mode = "menu";
        if (mode !== prev.mode) return { mode, index: 0, elapsed: 0 };

        const images = mode === "menu" ? current.menuImages : current.foodImages;
        const modeDuration =
          mode === "menu" ? current.screen.menuDurationSeconds : current.screen.foodDurationSeconds;
        const perImageDuration = Math.max(1, current.screen.perImageDurationSeconds);

        const elapsed = prev.elapsed + 1;
        if (elapsed >= modeDuration) {
          const otherAvailable = mode === "menu" ? foodAvailable : menuAvailable;
          const nextMode: Mode = otherAvailable ? (mode === "menu" ? "food" : "menu") : mode;
          return { mode: nextMode, index: 0, elapsed: 0 };
        }
        if (images.length > 1 && elapsed % perImageDuration === 0) {
          return { mode, elapsed, index: (prev.index + 1) % images.length };
        }
        return { mode, elapsed, index: prev.index };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentImages = data ? (cycle.mode === "menu" ? data.menuImages : data.foodImages) : [];
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

function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-black px-8 text-center">
      <p className="text-2xl font-semibold text-zinc-300">{title}</p>
      {subtitle && <p className="max-w-lg text-sm text-zinc-500">{subtitle}</p>}
    </div>
  );
}
