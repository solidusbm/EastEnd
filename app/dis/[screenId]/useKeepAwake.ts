"use client";

import { useEffect } from "react";

/**
 * A 2x2-pixel, three-second, silent H.264 clip (~1.8 KB, generated with
 * ffmpeg and committed) used only by the fallback path below. Baseline
 * profile deliberately: it's the one H.264 flavour every TV browser decodes.
 */
const FALLBACK_VIDEO_SRC = "/keep-awake.mp4";

/**
 * Holds the display awake for as long as this page is open and visible.
 *
 * Two mechanisms, tried in order, because no single one works everywhere:
 *
 * 1. **Screen Wake Lock API** — the real answer where it exists (Chromium
 *    84+, secure contexts only, which the hosted deployment satisfies). The
 *    platform drops the lock every time the page is hidden and never gives it
 *    back on its own, so re-acquiring on `visibilitychange` is required, not
 *    defensive padding.
 * 2. **A tiny looping video** — for TV browsers that predate the API or
 *    expose it but refuse the lock. Many devices suppress sleep and the
 *    screensaver while video is playing, which is what this borrows. It runs
 *    *only* when the wake lock is unavailable or rejected: cheap TV hardware
 *    has very few video decoders, and burning one permanently could starve
 *    the app's own MP4/GIF playback in the rotation.
 *
 * Be honest about the ceiling: a web page cannot always override an OS-level
 * sleep timer. On Fire TV in particular this suppresses the screensaver in
 * most cases, but if the stick is set to power the display down on a timer,
 * that is a device setting and only the device setting will fix it.
 */
export function useKeepAwake(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;
    let fallbackVideo: HTMLVideoElement | null = null;

    function startFallbackVideo() {
      if (cancelled || fallbackVideo) return;
      const video = document.createElement("video");
      video.src = FALLBACK_VIDEO_SRC;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      // Attribute as well as property: older TV browsers only honour the former.
      video.setAttribute("playsinline", "");
      video.setAttribute("aria-hidden", "true");
      // Kept on-screen and painted rather than `display:none` or
      // `visibility:hidden` -- a video the compositor never draws doesn't
      // count as playback on some devices, which would defeat the point.
      video.style.cssText =
        "position:fixed;left:0;bottom:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1";
      document.body.appendChild(video);
      fallbackVideo = video;
      video.play().catch(() => {
        // Muted autoplay is normally allowed without a gesture; if a browser
        // refuses anyway there's nothing sensible to do on an unattended TV.
      });
    }

    async function acquireWakeLock() {
      if (cancelled) return;
      if (!("wakeLock" in navigator)) {
        startFallbackVideo();
        return;
      }
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        // Fires on the platform's own release (page hidden, battery saver,
        // …). Clearing the ref is what lets handleVisibility re-acquire.
        lock.addEventListener("release", () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // Rejects when the document isn't visible, and on platforms that
        // expose the API but decline the lock. Both mean: use the video.
        startFallbackVideo();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (!sentinel) void acquireWakeLock();
      // A backgrounded tab pauses the fallback too; nudge it back.
      if (fallbackVideo) fallbackVideo.play().catch(() => {});
    }

    void acquireWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (sentinel) {
        sentinel.release().catch(() => {});
        sentinel = null;
      }
      if (fallbackVideo) {
        fallbackVideo.pause();
        fallbackVideo.remove();
        fallbackVideo = null;
      }
    };
  }, [enabled]);
}
