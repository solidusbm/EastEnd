"use client";

import { useEffect, useState } from "react";

interface Settings {
  githubBackupToken?: string;
  githubBackupRepo?: string;
  githubBackupBranch?: string;
  canvaClientId?: string;
  canvaClientSecret?: string;
  canvaRedirectUri?: string;
}

interface CanvaStatus {
  configured: boolean;
  connected: boolean;
}

type Message = { text: string; tone: "success" | "error" } | null;

const REDIRECT_MESSAGES: Record<string, { text: string; tone: "success" | "error" }> = {
  connected: { text: "Canva account connected.", tone: "success" },
  error: {
    text: "Connecting to Canva failed. Double-check the Client ID, Client Secret, and Redirect URI above, then try again.",
    tone: "error",
  },
  "not-configured": {
    text: "Canva isn't set up yet. Fill in and save the Client ID and Client Secret above, then click \"Connect Canva account\".",
    tone: "error",
  },
};

function MessageText({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p className={`text-sm ${message.tone === "success" ? "text-green-600" : "text-red-600"}`}>
      {message.text}
    </p>
  );
}

export default function SetupPanel() {
  const [githubToken, setGithubToken] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("");
  const [githubSaving, setGithubSaving] = useState(false);
  const [githubTesting, setGithubTesting] = useState(false);
  const [githubMessage, setGithubMessage] = useState<Message>(null);

  const [canvaClientId, setCanvaClientId] = useState("");
  const [canvaClientSecret, setCanvaClientSecret] = useState("");
  const [canvaRedirectUri, setCanvaRedirectUri] = useState("");
  const [canvaSaving, setCanvaSaving] = useState(false);
  const [canvaMessage, setCanvaMessage] = useState<Message>(null);
  const [currentHost, setCurrentHost] = useState("");

  const [canvaStatus, setCanvaStatus] = useState<CanvaStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState<Message>(null);

  async function fetchSettings(): Promise<Settings | null> {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    return res.ok ? ((await res.json()).settings as Settings) : null;
  }

  async function fetchCanvaStatus(): Promise<CanvaStatus | null> {
    const res = await fetch("/api/admin/canva/status", { cache: "no-store" });
    return res.ok ? ((await res.json()) as CanvaStatus) : null;
  }

  useEffect(() => {
    // Synchronizing from window.location (a browser API, not React state/props) is
    // exactly what an effect is for; this isn't the derived-state antipattern the rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentHost(window.location.host);
    fetchSettings().then((settings) => {
      if (!settings) return;
      setGithubToken(settings.githubBackupToken ?? "");
      setGithubRepo(settings.githubBackupRepo ?? "");
      setGithubBranch(settings.githubBackupBranch ?? "");
      setCanvaClientId(settings.canvaClientId ?? "");
      setCanvaClientSecret(settings.canvaClientSecret ?? "");
      setCanvaRedirectUri(
        settings.canvaRedirectUri || `${window.location.origin}/api/admin/canva/callback`
      );
    });
    fetchCanvaStatus().then((data) => {
      if (data) setCanvaStatus(data);
    });

    const params = new URLSearchParams(window.location.search);
    const canvaParam = params.get("canva");
    if (canvaParam && REDIRECT_MESSAGES[canvaParam]) {
      setRedirectMessage(REDIRECT_MESSAGES[canvaParam]);
      params.delete("canva");
      const newSearch = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (newSearch ? `?${newSearch}` : ""));
    }
  }, []);

  async function saveGithubSettings() {
    setGithubSaving(true);
    setGithubMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubBackupToken: githubToken,
          githubBackupRepo: githubRepo,
          githubBackupBranch: githubBranch,
        }),
      });
      setGithubMessage(
        res.ok
          ? { text: "Saved.", tone: "success" }
          : { text: "Could not save GitHub settings.", tone: "error" }
      );
    } finally {
      setGithubSaving(false);
    }
  }

  async function testGithubSettings() {
    setGithubTesting(true);
    setGithubMessage(null);
    try {
      const res = await fetch("/api/admin/settings/test-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: githubToken, repo: githubRepo }),
      });
      const data = await res.json();
      setGithubMessage(
        res.ok
          ? { text: "Connected -- token can access the repo.", tone: "success" }
          : { text: data.error ?? "Test failed.", tone: "error" }
      );
    } catch {
      setGithubMessage({ text: "Network error. Please try again.", tone: "error" });
    } finally {
      setGithubTesting(false);
    }
  }

  async function saveCanvaSettings() {
    setCanvaSaving(true);
    setCanvaMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvaClientId,
          canvaClientSecret,
          canvaRedirectUri,
        }),
      });
      setCanvaMessage(
        res.ok ? { text: "Saved.", tone: "success" } : { text: "Could not save Canva settings.", tone: "error" }
      );
      const status = await fetchCanvaStatus();
      if (status) setCanvaStatus(status);
    } finally {
      setCanvaSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect Canva? Linked images will stop auto-syncing until you reconnect.")) {
      return;
    }
    setDisconnecting(true);
    try {
      await fetch("/api/admin/canva/disconnect", { method: "POST" });
      const status = await fetchCanvaStatus();
      if (status) setCanvaStatus(status);
    } finally {
      setDisconnecting(false);
    }
  }

  const inputClass =
    "rounded-md border border-zinc-300 dark:border-zinc-700 bg-white text-zinc-900 px-2 py-1.5 text-sm outline-none focus:border-zinc-500";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">GitHub image backups</h3>
          <p className="text-sm text-zinc-500">
            Optional. Every image you upload or sync from Canva is also copied to a branch in a
            GitHub repo, permanently — deleting it in the app later never removes the backup copy.
          </p>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-zinc-500">
            <li>
              Create a{" "}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                fine-grained personal access token
              </a>{" "}
              scoped to the repo you want backups in, with <strong>Contents: Read and write</strong>{" "}
              permission.
            </li>
            <li>Paste the token and the repo (as owner/repo) into the fields below.</li>
            <li>
              Click &quot;Test connection&quot; to confirm the token can see the repo, then click Save.
            </li>
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Personal access token
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="github_pat_..."
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Repo (owner/repo)
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="e.g. your-username/your-repo"
              className={inputClass}
            />
            <span className="text-[11px] font-normal text-zinc-400">
              Can be this app&apos;s own repo or a separate one just for backups — whatever the
              token above has access to.
            </span>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Branch (optional)
            <input
              type="text"
              value={githubBranch}
              onChange={(e) => setGithubBranch(e.target.value)}
              placeholder="image-backups"
              className={inputClass}
            />
            <span className="text-[11px] font-normal text-zinc-400">
              Created automatically the first time a backup runs if it doesn&apos;t already exist.
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveGithubSettings}
            disabled={githubSaving}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
          >
            {githubSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={testGithubSettings}
            disabled={githubTesting || !githubToken || !githubRepo}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {githubTesting ? "Testing…" : "Test connection"}
          </button>
          <MessageText message={githubMessage} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Canva import/sync</h3>
          <ol className="list-decimal space-y-1 pl-4 text-sm text-zinc-500">
            <li>
              Go to{" "}
              <a
                href="https://www.canva.com/developers"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                canva.com/developers
              </a>{" "}
              and create a new integration.
            </li>
            <li>
              Under Scopes, add <code>design:meta:read</code> and <code>design:content:read</code>.
            </li>
            <li>
              Under Redirect URLs, add the exact URL shown in the &quot;Redirect URI&quot; field below
              (copy it from there — don&apos;t retype it).
            </li>
            <li>
              Copy the integration&apos;s <strong>Client ID</strong> and <strong>Client Secret</strong>{" "}
              into the fields below and click Save.
            </li>
            <li>Click &quot;Connect Canva account&quot; below and approve access.</li>
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Client ID
            <input
              type="text"
              value={canvaClientId}
              onChange={(e) => setCanvaClientId(e.target.value)}
              placeholder="from the integration's settings page"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Client secret
            <input
              type="password"
              value={canvaClientSecret}
              onChange={(e) => setCanvaClientSecret(e.target.value)}
              placeholder="from the integration's settings page"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Redirect URI
            <input
              type="text"
              value={canvaRedirectUri}
              onChange={(e) => setCanvaRedirectUri(e.target.value)}
              className={inputClass}
            />
            <span className="text-[11px] font-normal normal-case text-zinc-400">
              Must match, character-for-character, a Redirect URL registered on the Canva
              integration. Pre-filled from the address you&apos;re viewing this page at right now
              {currentHost && ` (${currentHost})`} — if that&apos;s not the address you&apos;ll
              actually use to reach /admin day-to-day (e.g. this looks like a dev/test URL rather
              than the restaurant PC&apos;s real one), edit it before saving.
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveCanvaSettings}
            disabled={canvaSaving}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
          >
            {canvaSaving ? "Saving…" : "Save"}
          </button>
          <MessageText message={canvaMessage} />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <p className="text-sm text-zinc-500">
            {canvaStatus?.connected
              ? "Connected. Linked images are checked for changes every few minutes."
              : "Not connected yet."}
          </p>
          {canvaStatus?.connected ? (
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
          )}
        </div>

        <MessageText message={redirectMessage} />
      </div>
    </div>
  );
}
