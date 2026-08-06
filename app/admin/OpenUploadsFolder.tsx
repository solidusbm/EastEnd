"use client";

import { useEffect, useState } from "react";

export default function OpenUploadsFolder() {
  const [path, setPath] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/uploads-folder", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPath(data.path);
      });
  }, []);

  async function handleOpen() {
    setOpening(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/uploads-folder", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setMessage("Opened on the server's desktop (only visible there).");
      } else if (data?.unavailable) {
        setMessage("Not available here — this only works on a local Windows install, not a hosted deployment. The folder path is shown above.");
      } else {
        setMessage("Could not open the folder.");
      }
    } catch {
      setMessage("Could not open the folder.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
      <button
        type="button"
        onClick={handleOpen}
        disabled={opening}
        className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
      >
        {opening ? "Opening…" : "Open uploads folder"}
      </button>
      {path && <code className="truncate">{path}</code>}
      {message && <span>{message}</span>}
    </div>
  );
}
