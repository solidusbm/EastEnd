"use client";

import { useEffect } from "react";
import { isVideoFile } from "@/lib/media";
import type { ImageRecord } from "@/lib/types";

/**
 * Full-screen, zero-latency preview of a single image -- for checking how
 * something will look on a TV without waiting through that screen's normal
 * rotation (which can take minutes with multiple categories queued ahead of
 * it) or physically walking over to look.
 */
export default function PreviewLightbox({
  image,
  onClose,
}: {
  image: ImageRecord | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!image) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6"
      onClick={(event) => {
        // Stop here -- this can be nested inside another dismissible overlay
        // (e.g. the image picker modal), whose own backdrop-click handler
        // shouldn't also fire and close that one too.
        event.stopPropagation();
        onClose();
      }}
    >
      {isVideoFile(image.url) ? (
        <video
          src={image.url}
          controls
          autoPlay
          loop
          playsInline
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image.url}
          alt={image.label || image.type}
          className="max-h-full max-w-full object-contain"
        />
      )}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1.5 text-sm text-white">
        {image.label || "(untitled)"} — click anywhere or press Esc to close
      </div>
    </div>
  );
}
