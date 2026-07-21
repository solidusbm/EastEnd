"use client";

import { useEffect, useState } from "react";

interface CanvaStatus {
  configured: boolean;
  connected: boolean;
}

const REDIRECT_MESSAGES: Record<string, { text: string; tone: "success" | "error" }> = {
  connected: { text: "Canva account connected.", tone: "success" },
  error: { text: "Connecting to Canva failed. Please try again.", tone: "error" },
  "not-configured": {
    text: "Canva import isn't configured on this server yet.",
    tone: "error",
  },
};

export default function CanvaPanel() {
  const [status, setStatus] = useState<CanvaStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );

  async function fetchStatus(): Promise<CanvaStatus | null> {
    const res = await fetch("/api/admin/canva/status", { cache: "no-store" });
    return res.ok ? ((await res.json()) as CanvaStatus) : null;
  }

  useEffect(() => {
    fetchStatus().then((data) => {
      if (data) setStatus(data);
    });

    const params = new URLSearchParams(window.location.search);
    const canvaParam = params.get("canva");
    if (canvaParam && REDIRECT_MESSAGES[canvaParam]) {
      // Synchronizing from window.location (a browser API, not React state/props) is
      // exactly what an effect is for; this isn't the derived-state antipattern the rule targets.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRedirectMessage(REDIRECT_MESSAGES[canvaParam]);
      params.delete("canva");
      const newSearch = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (newSearch ? `?${newSearch}` : ""));
    }
  }, []);

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Canva? Linked images will stop auto-syncing until you reconnect.")) {
      return;
    }
    setDisconnecting(true);
    try {
      await fetch("/api/admin/canva/disconnect", { method: "POST" });
      const data = await fetchStatus();
      if (data) setStatus(data);
    } finally {
      setDisconnecting(false);
    }
  }

  if (!status) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Canva</h2>
          <p className="text-sm text-zinc-500">
            Link images to a Canva design so they update automatically when you edit the design.
          </p>
        </div>
        {status.configured &&
          (status.connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          ) : (
            <a
              href="/api/admin/canva/connect"
              className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900"
            >
              Connect Canva account
            </a>
          ))}
      </div>

      {redirectMessage && (
        <p className={`text-sm ${redirectMessage.tone === "success" ? "text-green-600" : "text-red-600"}`}>
          {redirectMessage.text}
        </p>
      )}

      {!status.configured && (
        <p className="text-xs text-zinc-400">
          Set CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, and CANVA_REDIRECT_URI in .env.local to enable this.
        </p>
      )}
      {status.configured && status.connected && (
        <p className="text-xs text-zinc-400">
          Connected. Linked images are checked for changes every few minutes automatically.
        </p>
      )}
    </div>
  );
}
