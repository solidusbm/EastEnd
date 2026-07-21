import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

// Integration credentials set from the admin UI, stored locally so they
// survive restarts without editing .env.local by hand. Any field left
// unset here falls back to its env var (see lib/canva.ts / lib/githubBackup.ts),
// so existing .env.local-based setups keep working untouched.
const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

export interface AppSettings {
  githubBackupToken?: string;
  githubBackupRepo?: string;
  githubBackupBranch?: string;
  canvaClientId?: string;
  canvaClientSecret?: string;
  canvaRedirectUri?: string;
}

export async function readSettings(): Promise<AppSettings> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as AppSettings;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

export async function writeSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await readSettings();
  const next: AppSettings = { ...current, ...patch };
  await mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${SETTINGS_PATH}.${process.pid}.tmp`;
  await writeFile(tmpPath, JSON.stringify(next, null, 2), "utf-8");
  await rename(tmpPath, SETTINGS_PATH);
  return next;
}
