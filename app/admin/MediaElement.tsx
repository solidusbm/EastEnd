"use client";

import { isVideoFile } from "@/lib/media";

/**
 * Drop-in replacement for a bare <img> wherever an ImageRecord's thumbnail
 * is rendered -- swaps to a muted, no-controls <video> for actual video
 * files so it at least shows a first-frame thumbnail; GIFs keep using <img>
 * since they already animate natively there.
 */
export default function MediaElement({
  url,
  label,
  className,
  onClick,
}: {
  url: string;
  label?: string;
  className?: string;
  onClick?: () => void;
}) {
  if (isVideoFile(url)) {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        onClick={onClick}
        className={className}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={label || ""} onClick={onClick} className={className} />
  );
}
