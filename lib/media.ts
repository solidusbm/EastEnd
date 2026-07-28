// Whether something is a video/GIF is derived from its filename extension
// rather than stored as a field -- images, GIFs, and videos are all just
// ImageRecords with different URLs, so every existing path that already
// carries a filename/URL (upload, Canva import, signage sync, GitHub backup
// restore) gets video/GIF support automatically, with nothing new to thread
// through.
export type MediaKind = "image" | "gif" | "video";

// Scoped deliberately narrow: MP4/H.264 is the one format reliably
// hardware-decoded across the WebOS/Tizen smart TV browsers this app
// targets (see README) -- WebM/MOV/etc are not accepted on upload, though
// mediaKind() below would still classify them as "video" if one somehow
// ended up on disk (e.g. hand-copied), so playback doesn't just break.
const VIDEO_EXTENSIONS = new Set([".mp4", ".m4v", ".mov", ".webm"]);
const GIF_EXTENSION = ".gif";

export const ACCEPTED_VIDEO_MIME_TYPES = ["video/mp4"];
export const UPLOAD_ACCEPT_ATTR = "image/*,video/mp4";

// Signage rotation slots, not a video player -- see the scoping discussion.
// Keeps local disk, GitHub backup (hard-blocks over 100MB via the Contents
// API), and TV decode load all sane.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function extname(filenameOrUrl: string): string {
  const clean = filenameOrUrl.split(/[?#]/)[0];
  const dot = clean.lastIndexOf(".");
  return dot === -1 ? "" : clean.slice(dot).toLowerCase();
}

export function mediaKind(filenameOrUrl: string): MediaKind {
  const ext = extname(filenameOrUrl);
  if (ext === GIF_EXTENSION) return "gif";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "image";
}

/** True for anything that should get the "video" marker/badge in the admin UI -- real video files and GIFs alike, since both are motion content. */
export function isMotionMedia(filenameOrUrl: string): boolean {
  return mediaKind(filenameOrUrl) !== "image";
}

/** True only for content that needs an actual <video> tag (not GIF, which plays natively via <img>). */
export function isVideoFile(filenameOrUrl: string): boolean {
  return mediaKind(filenameOrUrl) === "video";
}

/** Validates an uploaded file's declared MIME type -- images (incl. image/gif) or MP4 video. */
export function isAcceptedUploadMimeType(mimeType: string): boolean {
  return mimeType.startsWith("image/") || ACCEPTED_VIDEO_MIME_TYPES.includes(mimeType);
}
