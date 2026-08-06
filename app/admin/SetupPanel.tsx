"use client";

import { useEffect, useState } from "react";
import { IMAGE_TYPE_LABELS, IMAGE_TYPES, type ImageType } from "@/lib/types";
import {
  DEFAULT_LABEL_STYLE,
  LABEL_FONT_CSS_VARS,
  LABEL_FONT_FAMILIES,
  LABEL_FONT_FAMILY_LABELS,
  hexToRgba,
  type LabelFontFamily,
} from "@/lib/labelStyle";
import { LABEL_FONT_VARIABLES } from "../dis/fonts";

interface Settings {
  githubBackupToken?: string;
  githubBackupRepo?: string;
  githubBackupBranch?: string;
  canvaClientId?: string;
  canvaClientSecret?: string;
  canvaRedirectUri?: string;
  labelFontSize?: string;
  labelFontFamily?: string;
  labelTextColor?: string;
  labelBackgroundColor?: string;
  labelBackgroundOpacity?: string;
}

interface CanvaStatus {
  configured: boolean;
  connected: boolean;
}

interface BackupItem {
  filename: string;
  alreadyImported: boolean;
}

interface PlaylistBackupItem {
  id: string;
  name: string;
  imageFilenames: string[];
  imageDurationOverrides: Record<string, number>;
  alreadyImported: boolean;
}

interface BackupsInfo {
  configured: boolean;
  backups: Record<ImageType, BackupItem[]> | null;
  playlistBackups: PlaylistBackupItem[] | null;
}

interface ServerInfo {
  currentPort: string;
  addresses: string[];
  configuredPort: string;
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

const MIN_PASSWORD_LENGTH = 8;

interface SetupPanelProps {
  /** Called after a successful import so the image library reflects the new images. */
  onImported?: () => void;
  /** Called after a successful import so the saved-playlists library reflects the new playlists. */
  onPlaylistsImported?: () => void;
}

export default function SetupPanel({ onImported, onPlaylistsImported }: SetupPanelProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);

  const [githubToken, setGithubToken] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubBranch, setGithubBranch] = useState("");
  const [githubSaving, setGithubSaving] = useState(false);
  const [githubTesting, setGithubTesting] = useState(false);
  const [githubMessage, setGithubMessage] = useState<Message>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [backupNowMessage, setBackupNowMessage] = useState<Message>(null);

  const [backupsInfo, setBackupsInfo] = useState<BackupsInfo | null>(null);
  const [checkingBackups, setCheckingBackups] = useState(false);
  const [importingBackups, setImportingBackups] = useState(false);
  const [backupsMessage, setBackupsMessage] = useState<Message>(null);

  const [canvaClientId, setCanvaClientId] = useState("");
  const [canvaClientSecret, setCanvaClientSecret] = useState("");
  const [canvaRedirectUri, setCanvaRedirectUri] = useState("");
  const [canvaSaving, setCanvaSaving] = useState(false);
  const [canvaMessage, setCanvaMessage] = useState<Message>(null);
  const [currentHost, setCurrentHost] = useState("");

  const [canvaStatus, setCanvaStatus] = useState<CanvaStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState<Message>(null);

  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [portInput, setPortInput] = useState("");
  const [portSaving, setPortSaving] = useState(false);
  const [portMessage, setPortMessage] = useState<Message>(null);

  const [labelFontSize, setLabelFontSize] = useState(String(DEFAULT_LABEL_STYLE.fontSize));
  const [labelFontFamily, setLabelFontFamily] = useState<LabelFontFamily>(DEFAULT_LABEL_STYLE.fontFamily);
  const [labelTextColor, setLabelTextColor] = useState(DEFAULT_LABEL_STYLE.textColor);
  const [labelBackgroundColor, setLabelBackgroundColor] = useState(DEFAULT_LABEL_STYLE.backgroundColor);
  const [labelBackgroundOpacity, setLabelBackgroundOpacity] = useState(DEFAULT_LABEL_STYLE.backgroundOpacity);
  const [labelStyleSaving, setLabelStyleSaving] = useState(false);
  const [labelStyleMessage, setLabelStyleMessage] = useState<Message>(null);

  async function fetchSettings(): Promise<Settings | null> {
    const res = await fetch("/api/admin/settings", { cache: "no-store" });
    return res.ok ? ((await res.json()).settings as Settings) : null;
  }

  async function fetchCanvaStatus(): Promise<CanvaStatus | null> {
    const res = await fetch("/api/admin/canva/status", { cache: "no-store" });
    return res.ok ? ((await res.json()) as CanvaStatus) : null;
  }

  async function fetchServerInfo(): Promise<ServerInfo | null> {
    const res = await fetch("/api/admin/server-info", { cache: "no-store" });
    return res.ok ? ((await res.json()) as ServerInfo) : null;
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
      setLabelFontSize(settings.labelFontSize ?? String(DEFAULT_LABEL_STYLE.fontSize));
      setLabelFontFamily(
        LABEL_FONT_FAMILIES.includes(settings.labelFontFamily as LabelFontFamily)
          ? (settings.labelFontFamily as LabelFontFamily)
          : DEFAULT_LABEL_STYLE.fontFamily
      );
      setLabelTextColor(settings.labelTextColor ?? DEFAULT_LABEL_STYLE.textColor);
      setLabelBackgroundColor(settings.labelBackgroundColor ?? DEFAULT_LABEL_STYLE.backgroundColor);
      setLabelBackgroundOpacity(
        settings.labelBackgroundOpacity !== undefined
          ? Number(settings.labelBackgroundOpacity)
          : DEFAULT_LABEL_STYLE.backgroundOpacity
      );
    });
    fetchCanvaStatus().then((data) => {
      if (data) setCanvaStatus(data);
    });
    fetchServerInfo().then((info) => {
      if (!info) return;
      setServerInfo(info);
      setPortInput(info.configuredPort || info.currentPort);
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

  async function changePassword() {
    setPasswordMessage(null);
    if (!currentPassword) {
      setPasswordMessage({ text: "Enter your current password.", tone: "error" });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordMessage({
        text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        tone: "error",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ text: "Passwords don't match.", tone: "error" });
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMessage({ text: data.error ?? "Could not change the password.", tone: "error" });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage({ text: "Password changed.", tone: "success" });
    } catch {
      setPasswordMessage({ text: "Network error. Please try again.", tone: "error" });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function savePort() {
    setPortMessage(null);
    const trimmed = portInput.trim();
    const portNum = Number(trimmed);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      setPortMessage({ text: "Enter a whole number between 1 and 65535.", tone: "error" });
      return;
    }

    setPortSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverPort: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPortMessage({ text: data.error ?? "Could not save the port.", tone: "error" });
        return;
      }
      setServerInfo((prev) => (prev ? { ...prev, configuredPort: trimmed } : prev));
      setPortMessage(
        serverInfo && trimmed === serverInfo.currentPort
          ? { text: "Saved. Already running on this port.", tone: "success" }
          : {
              text:
                "Saved. Restart the server for this to take effect (restart the EastEndTVSignage service, or restart npm run dev/start) — remember to also update the firewall rule and any bookmarked TV URLs.",
              tone: "success",
            }
      );
    } catch {
      setPortMessage({ text: "Network error. Please try again.", tone: "error" });
    } finally {
      setPortSaving(false);
    }
  }

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

  async function backupNow() {
    setBackingUp(true);
    setBackupNowMessage(null);
    try {
      const res = await fetch("/api/admin/github-backups/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setBackupNowMessage({ text: data.error ?? "Backup failed.", tone: "error" });
        return;
      }
      const totalFailed = data.failed + data.playlistsFailed;
      setBackupNowMessage({
        text:
          `Images: backed up ${data.backedUp}, ${data.upToDate} already up to date.` +
          ` Playlists: backed up ${data.playlistsBackedUp}, ${data.playlistsUpToDate} already up to date.` +
          (totalFailed > 0 ? ` ${totalFailed} failed -- see server logs.` : ""),
        tone: totalFailed > 0 ? "error" : "success",
      });
    } catch {
      setBackupNowMessage({ text: "Network error. Please try again.", tone: "error" });
    } finally {
      setBackingUp(false);
    }
  }

  async function checkBackups() {
    setCheckingBackups(true);
    setBackupsMessage(null);
    try {
      const res = await fetch("/api/admin/github-backups", { cache: "no-store" });
      const data = (await res.json()) as BackupsInfo;
      if (!res.ok || !data.configured) {
        setBackupsInfo(null);
        setBackupsMessage({
          text: "GitHub backup isn't configured above yet -- nothing to check.",
          tone: "error",
        });
        return;
      }
      setBackupsInfo(data);
      const total = IMAGE_TYPES.reduce((sum, t) => sum + (data.backups?.[t]?.length ?? 0), 0);
      if (total === 0 && (data.playlistBackups?.length ?? 0) === 0) {
        setBackupsMessage({ text: "No backed-up images or playlists found on GitHub yet.", tone: "success" });
      }
    } catch {
      setBackupsMessage({ text: "Network error. Please try again.", tone: "error" });
    } finally {
      setCheckingBackups(false);
    }
  }

  async function importMissingBackups() {
    if (!backupsInfo?.backups) return;
    const items = IMAGE_TYPES.flatMap((type) =>
      backupsInfo.backups![type].filter((b) => !b.alreadyImported).map((b) => ({ type, filename: b.filename }))
    );
    const playlists = (backupsInfo.playlistBackups ?? [])
      .filter((p) => !p.alreadyImported)
      .map((p) => ({
        id: p.id,
        name: p.name,
        imageFilenames: p.imageFilenames,
        imageDurationOverrides: p.imageDurationOverrides,
      }));
    if (items.length === 0 && playlists.length === 0) return;

    setImportingBackups(true);
    setBackupsMessage(null);
    try {
      const res = await fetch("/api/admin/github-backups/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, playlists }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBackupsMessage({ text: data.error ?? "Import failed.", tone: "error" });
        return;
      }
      setBackupsMessage({
        text:
          `Imported ${data.imported} image${data.imported === 1 ? "" : "s"} and ${data.playlistsImported} playlist${data.playlistsImported === 1 ? "" : "s"}.` +
          (data.failed > 0 ? ` ${data.failed} image(s) failed -- see server logs.` : ""),
        tone: data.failed > 0 ? "error" : "success",
      });
      onImported?.();
      onPlaylistsImported?.();
      await checkBackups();
    } catch {
      setBackupsMessage({ text: "Network error. Please try again.", tone: "error" });
    } finally {
      setImportingBackups(false);
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

  async function saveLabelStyle() {
    setLabelStyleSaving(true);
    setLabelStyleMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          labelFontSize,
          labelFontFamily,
          labelTextColor,
          labelBackgroundColor,
          labelBackgroundOpacity,
        }),
      });
      const data = await res.json();
      setLabelStyleMessage(
        res.ok ? { text: "Saved.", tone: "success" } : { text: data.error ?? "Could not save.", tone: "error" }
      );
    } catch {
      setLabelStyleMessage({ text: "Network error. Please try again.", tone: "error" });
    } finally {
      setLabelStyleSaving(false);
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
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Server address</h3>
          <p className="text-sm text-zinc-500">
            What TVs and other devices on the network use to reach this app.
          </p>
        </div>

        {serverInfo ? (
          <ul className="flex flex-col gap-1 text-sm">
            {serverInfo.addresses.length > 0 ? (
              serverInfo.addresses.map((addr) => (
                <li key={addr}>
                  <a
                    href={`http://${addr}:${serverInfo.currentPort}/admin`}
                    className="text-blue-600 hover:underline"
                  >
                    http://{addr}:{serverInfo.currentPort}
                  </a>
                  <span className="text-zinc-400"> — use this on the TVs and other devices</span>
                </li>
              ))
            ) : (
              <li className="text-zinc-500">
                No local network address detected — expected if this server isn&apos;t on a local
                network (e.g. a hosted/remote deployment reached over the internet instead).
              </li>
            )}
            <li className="text-zinc-400">
              http://localhost:{serverInfo.currentPort} — from this machine only
            </li>
          </ul>
        ) : (
          <p className="text-sm text-zinc-400">Loading…</p>
        )}

        <div className="flex flex-col gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-3 sm:w-64">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Port
            <input
              type="number"
              min={1}
              max={65535}
              value={portInput}
              onChange={(e) => setPortInput(e.target.value)}
              className={inputClass}
            />
          </label>
          <p className="text-[11px] font-normal normal-case text-zinc-400">
            Currently running on {serverInfo?.currentPort ?? "…"}. Change this only if that port
            conflicts with something else on this machine — saving here doesn&apos;t apply it
            immediately, the server needs a restart to pick it up.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={savePort}
            disabled={portSaving || !portInput}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
          >
            {portSaving ? "Saving…" : "Save port"}
          </button>
          <MessageText message={portMessage} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">GitHub backups</h3>
          <p className="text-sm text-zinc-500">
            Optional. Every image you upload or sync from Canva, and every saved playlist, is also
            copied to a branch in a GitHub repo, permanently — deleting either in the app later
            never removes the backup copy.
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
        </div>
        <MessageText message={githubMessage} />

        <div className="flex items-center gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-3">
          <button
            type="button"
            onClick={backupNow}
            disabled={backingUp || !githubToken || !githubRepo}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {backingUp ? "Backing up…" : "Back up now"}
          </button>
          <span className="text-[11px] text-zinc-400">
            Backs up every current image and saved playlist, checked by content — catches
            anything created before this was configured, and re-uploads anything that&apos;s
            changed since its last backup, even under the same filename/name.
          </span>
          <MessageText message={backupNowMessage} />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Restore from GitHub backups
          </h3>
          <p className="text-sm text-zinc-500">
            Pull previously backed-up images and playlists back into this install — useful after a
            reinstall or a fresh clone, where <code>public/uploads/</code> and{" "}
            <code>data/config.json</code> start out empty. Requires the GitHub backup settings
            above to be filled in and saved first. Restored images land back in their original
            category, re-labeled from their filename (any custom label or screen assignment
            isn&apos;t backed up, so those need re-doing). Restored playlists reconnect to
            whichever of their images end up present locally (importing both together in one go
            resolves this automatically); any image that never makes it back is just dropped from
            the restored playlist.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={checkBackups}
            disabled={checkingBackups}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            {checkingBackups ? "Checking…" : "Check for backups"}
          </button>
          {!backupsInfo && <MessageText message={backupsMessage} />}
        </div>

        {backupsInfo?.backups && (
          <div className="flex flex-col gap-3">
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {IMAGE_TYPES.map((type) => {
                const items = backupsInfo.backups![type];
                const missing = items.filter((b) => !b.alreadyImported).length;
                return (
                  <li
                    key={type}
                    className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2"
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">
                      {IMAGE_TYPE_LABELS[type]}
                    </div>
                    <div className="text-zinc-500">
                      {items.length} backed up
                      {missing > 0 ? `, ${missing} new` : ""}
                    </div>
                  </li>
                );
              })}
              {(() => {
                const playlists = backupsInfo.playlistBackups ?? [];
                const missing = playlists.filter((p) => !p.alreadyImported).length;
                return (
                  <li className="rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2">
                    <div className="font-medium text-zinc-900 dark:text-zinc-50">Playlists</div>
                    <div className="text-zinc-500">
                      {playlists.length} backed up
                      {missing > 0 ? `, ${missing} new` : ""}
                    </div>
                  </li>
                );
              })()}
            </ul>

            {(() => {
              const totalMissingImages = IMAGE_TYPES.reduce(
                (sum, t) => sum + backupsInfo.backups![t].filter((b) => !b.alreadyImported).length,
                0
              );
              const totalMissingPlaylists = (backupsInfo.playlistBackups ?? []).filter(
                (p) => !p.alreadyImported
              ).length;
              const totalMissing = totalMissingImages + totalMissingPlaylists;
              return totalMissing > 0 ? (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={importMissingBackups}
                    disabled={importingBackups}
                    className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
                  >
                    {importingBackups
                      ? "Importing…"
                      : `Import ${totalMissingImages} new image${totalMissingImages === 1 ? "" : "s"} and ${totalMissingPlaylists} playlist${totalMissingPlaylists === 1 ? "" : "s"}`}
                  </button>
                  <MessageText message={backupsMessage} />
                </div>
              ) : (
                <MessageText message={backupsMessage ?? { text: "Everything's already imported.", tone: "success" }} />
              );
            })()}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Image label style</h3>
          <p className="text-sm text-zinc-500">
            One global style for every caption shown on the displays -- from each image&apos;s
            &quot;show label&quot; checkbox, in both the main rotation and picture-in-picture. Font
            choices are matched to the fonts already used across your uploaded menus.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Font size (px)
            <input
              type="number"
              min={8}
              max={200}
              value={labelFontSize}
              onChange={(e) => setLabelFontSize(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Font
            <select
              value={labelFontFamily}
              onChange={(e) => setLabelFontFamily(e.target.value as LabelFontFamily)}
              className={inputClass}
            >
              {LABEL_FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {LABEL_FONT_FAMILY_LABELS[f]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Text color
            <input
              type="color"
              value={labelTextColor}
              onChange={(e) => setLabelTextColor(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white px-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Background color
            <input
              type="color"
              value={labelBackgroundColor}
              onChange={(e) => setLabelBackgroundColor(e.target.value)}
              className="h-9 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white px-1"
            />
          </label>
        </div>

        <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Background opacity ({labelBackgroundOpacity}%)
          <input
            type="range"
            min={0}
            max={100}
            value={labelBackgroundOpacity}
            onChange={(e) => setLabelBackgroundOpacity(Number(e.target.value))}
          />
        </label>

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Preview</p>
          <div
            className={`relative h-32 overflow-hidden rounded-lg bg-zinc-700 ${LABEL_FONT_VARIABLES}`}
          >
            <div
              className="absolute inset-x-0 bottom-0 px-6 py-3 text-center"
              style={{
                fontSize: `${labelFontSize}px`,
                color: labelTextColor,
                backgroundColor: hexToRgba(labelBackgroundColor, labelBackgroundOpacity),
                fontFamily: LABEL_FONT_CSS_VARS[labelFontFamily],
              }}
            >
              <p className="font-medium">Sweet Heat</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveLabelStyle}
            disabled={labelStyleSaving}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
          >
            {labelStyleSaving ? "Saving…" : "Save"}
          </button>
          <MessageText message={labelStyleMessage} />
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
              than the one you&apos;ll actually use), edit it before saving.
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

      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Admin password</h3>
          <p className="text-sm text-zinc-500">
            Changes the password used to log into <code>/admin</code>. You&apos;ll stay signed in
            here, but anyone else currently logged in elsewhere will be signed out.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`at least ${MIN_PASSWORD_LENGTH} characters`}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={changePassword}
            disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
            className="rounded-md bg-zinc-900 dark:bg-zinc-50 px-3 py-1.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-50"
          >
            {passwordSaving ? "Changing…" : "Change password"}
          </button>
          <MessageText message={passwordMessage} />
        </div>
      </div>
    </div>
  );
}
