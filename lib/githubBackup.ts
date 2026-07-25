// Best-effort permanent backup of uploaded images to a GitHub branch, using
// the REST Contents API directly (no local git working tree/credentials
// needed — just an HTTPS call with a token). Deleting an image in the app
// never touches this backup; it's a one-way archive. Images are stored under
// backups/<type>/<filename> so a later restore (see importGithubBackup)
// knows each image's category without needing separately-backed-up metadata.
import { createHash } from "crypto";
import { readSettings } from "./settings";
import { IMAGE_TYPES, type ImageType } from "./types";

/** Git's own blob hash (sha1("blob " + size + "\0" + content)) -- lets us tell
 * whether local content actually differs from what's already backed up,
 * rather than assuming a filename match means the content is unchanged. */
function gitBlobSha(content: Buffer): string {
  const header = Buffer.from(`blob ${content.length}\0`, "utf8");
  return createHash("sha1").update(Buffer.concat([header, content])).digest("hex");
}

const API_BASE = "https://api.github.com";

interface GithubBackupConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export async function getGithubBackupConfig(): Promise<GithubBackupConfig | null> {
  const settings = await readSettings();
  const token = settings.githubBackupToken || process.env.GITHUB_BACKUP_TOKEN;
  const repoSlug = settings.githubBackupRepo || process.env.GITHUB_BACKUP_REPO;
  if (!token || !repoSlug) return null;
  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) return null;
  return {
    token,
    owner,
    repo,
    branch: settings.githubBackupBranch || process.env.GITHUB_BACKUP_BRANCH || "image-backups",
  };
}

export async function isGithubBackupConfigured(): Promise<boolean> {
  return (await getGithubBackupConfig()) !== null;
}

function headers(config: GithubBackupConfig): HeadersInit {
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "eastend-tv-signage",
  };
}

async function ensureBranchExists(config: GithubBackupConfig): Promise<void> {
  const branchRes = await fetch(
    `${API_BASE}/repos/${config.owner}/${config.repo}/git/ref/heads/${config.branch}`,
    { headers: headers(config) }
  );
  if (branchRes.ok) return;
  if (branchRes.status !== 404) {
    throw new Error(`Checking backup branch failed (${branchRes.status}).`);
  }

  const repoRes = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}`, {
    headers: headers(config),
  });
  if (!repoRes.ok) throw new Error(`Fetching repo info failed (${repoRes.status}).`);
  const repoData = (await repoRes.json()) as { default_branch: string };

  const defaultRefRes = await fetch(
    `${API_BASE}/repos/${config.owner}/${config.repo}/git/ref/heads/${repoData.default_branch}`,
    { headers: headers(config) }
  );
  if (!defaultRefRes.ok) throw new Error(`Fetching default branch ref failed (${defaultRefRes.status}).`);
  const defaultRefData = (await defaultRefRes.json()) as { object: { sha: string } };

  const createRes = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}/git/refs`, {
    method: "POST",
    headers: { ...headers(config), "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${config.branch}`, sha: defaultRefData.object.sha }),
  });
  if (!createRes.ok && createRes.status !== 422) {
    // 422 here means another request created the branch concurrently -- fine.
    throw new Error(`Creating backup branch failed (${createRes.status}).`);
  }
}

async function getExistingFileSha(config: GithubBackupConfig, path: string): Promise<string | null> {
  const res = await fetch(
    `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`,
    { headers: headers(config) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Checking existing backup file failed (${res.status}).`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

/**
 * Uploads (or updates) a file at backups/<type>/<filename> on the
 * configured branch. If a file already exists at that path, its content is
 * compared (via git's own blob hash) against what we're about to upload --
 * a same-name file with different content is still an update, never
 * silently skipped; only byte-identical content is skipped. Returns whether
 * anything was actually written. Best-effort: callers should not await this
 * on the critical path of a request -- fire it and log/ignore failures.
 */
export async function backupImageToGithub(
  type: ImageType,
  filename: string,
  content: Buffer
): Promise<boolean> {
  const config = await getGithubBackupConfig();
  if (!config) return false;

  const path = `backups/${type}/${filename}`;
  await ensureBranchExists(config);
  const existingSha = await getExistingFileSha(config, path);

  if (existingSha && existingSha === gitBlobSha(content)) {
    return false; // Already backed up with identical content -- nothing to do.
  }

  const res = await fetch(`${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(config), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Back up ${filename}`,
      content: content.toString("base64"),
      branch: config.branch,
      ...(existingSha ? { sha: existingSha } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Uploading backup failed (${res.status}): ${text}`);
  }
  return true;
}

/** Fire-and-forget wrapper: never throws, just logs on failure. No-ops if unconfigured. */
export function backupImageToGithubBestEffort(type: ImageType, filename: string, content: Buffer): void {
  backupImageToGithub(type, filename, content).catch((err) => {
    console.error(`[github-backup] Failed to back up ${filename}:`, err);
  });
}

/**
 * Lists backed-up filenames per category (backups/<type>/*) on the
 * configured branch. Returns null if GitHub backup isn't configured. A
 * category with no backups folder yet (never backed up) comes back as [].
 */
export async function listGithubBackups(): Promise<Record<ImageType, string[]> | null> {
  const config = await getGithubBackupConfig();
  if (!config) return null;

  const result = {} as Record<ImageType, string[]>;
  await Promise.all(
    IMAGE_TYPES.map(async (type) => {
      const res = await fetch(
        `${API_BASE}/repos/${config.owner}/${config.repo}/contents/backups/${type}?ref=${config.branch}`,
        { headers: headers(config) }
      );
      if (res.status === 404) {
        result[type] = [];
        return;
      }
      if (!res.ok) throw new Error(`Listing backups/${type} failed (${res.status}).`);
      const entries = (await res.json()) as { name: string; type: string }[];
      result[type] = entries.filter((e) => e.type === "file").map((e) => e.name);
    })
  );
  return result;
}

/** Downloads a single backed-up file's raw bytes, regardless of size. */
export async function downloadGithubBackup(type: ImageType, filename: string): Promise<Buffer> {
  const config = await getGithubBackupConfig();
  if (!config) throw new Error("GitHub backup isn't configured.");

  const res = await fetch(
    `${API_BASE}/repos/${config.owner}/${config.repo}/contents/backups/${type}/${filename}?ref=${config.branch}`,
    { headers: { ...headers(config), Accept: "application/vnd.github.raw" } }
  );
  if (!res.ok) throw new Error(`Downloading backups/${type}/${filename} failed (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

/** Validates a token/repo pair (as typed in the settings form, before saving) by checking repo access. */
export async function testGithubBackupConnection(
  token: string,
  repoSlug: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) {
    return { ok: false, error: 'Repo must be in "owner/repo" form.' };
  }
  try {
    const res = await fetch(`${API_BASE}/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "eastend-tv-signage",
      },
    });
    if (res.status === 401) return { ok: false, error: "Token was rejected (invalid or expired)." };
    if (res.status === 404) {
      return { ok: false, error: "Repo not found, or the token can't see it (check its permissions)." };
    }
    if (!res.ok) return { ok: false, error: `GitHub returned ${res.status}.` };
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error reaching GitHub." };
  }
}
