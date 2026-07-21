// Best-effort permanent backup of uploaded images to a GitHub branch, using
// the REST Contents API directly (no local git working tree/credentials
// needed — just an HTTPS call with a token). Deleting an image in the app
// never touches this backup; it's a one-way archive.
const API_BASE = "https://api.github.com";

interface GithubBackupConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

function getConfig(): GithubBackupConfig | null {
  const token = process.env.GITHUB_BACKUP_TOKEN;
  const repoSlug = process.env.GITHUB_BACKUP_REPO;
  if (!token || !repoSlug) return null;
  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) return null;
  return {
    token,
    owner,
    repo,
    branch: process.env.GITHUB_BACKUP_BRANCH || "image-backups",
  };
}

export function isGithubBackupConfigured(): boolean {
  return getConfig() !== null;
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
 * Uploads (or updates) a file at backups/<filename> on the configured
 * branch. Best-effort: callers should not await this on the critical path
 * of a request -- fire it and log/ignore failures.
 */
export async function backupImageToGithub(filename: string, content: Buffer): Promise<void> {
  const config = getConfig();
  if (!config) return;

  const path = `backups/${filename}`;
  await ensureBranchExists(config);
  const existingSha = await getExistingFileSha(config, path);

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
}

/** Fire-and-forget wrapper: never throws, just logs on failure. */
export function backupImageToGithubBestEffort(filename: string, content: Buffer): void {
  if (!isGithubBackupConfigured()) return;
  backupImageToGithub(filename, content).catch((err) => {
    console.error(`[github-backup] Failed to back up ${filename}:`, err);
  });
}
