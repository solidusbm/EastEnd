import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

// Canva OAuth tokens live in their own small local file, separate from
// data/config.json — they refresh on their own schedule (independent of any
// screen/image edit) and shouldn't risk being clobbered by writeStore().
const DATA_DIR = path.join(process.cwd(), "data");
const TOKENS_PATH = path.join(DATA_DIR, "canva-tokens.json");

export interface CanvaTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix ms timestamp when accessToken expires. */
  expiresAt: number;
}

export async function readCanvaTokens(): Promise<CanvaTokens | null> {
  try {
    const raw = await readFile(TOKENS_PATH, "utf-8");
    return JSON.parse(raw) as CanvaTokens;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeCanvaTokens(tokens: CanvaTokens): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${TOKENS_PATH}.${process.pid}.tmp`;
  await writeFile(tmpPath, JSON.stringify(tokens, null, 2), "utf-8");
  await rename(tmpPath, TOKENS_PATH);
}

export async function clearCanvaTokens(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${TOKENS_PATH}.${process.pid}.tmp`;
  await writeFile(tmpPath, "null", "utf-8");
  await rename(tmpPath, TOKENS_PATH);
}
