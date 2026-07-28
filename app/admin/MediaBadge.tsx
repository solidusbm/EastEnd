import { isMotionMedia, isVideoFile } from "@/lib/media";

/** Small "Video"/"GIF" tag overlaid on a thumbnail -- the only thing that distinguishes motion media from a static image anywhere in the admin UI. Renders nothing for plain images. */
export default function MediaBadge({ url, className }: { url: string; className?: string }) {
  if (!isMotionMedia(url)) return null;
  return (
    <span
      className={`pointer-events-none absolute flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white ${className ?? ""}`}
    >
      ▶ {isVideoFile(url) ? "Video" : "GIF"}
    </span>
  );
}
