import { list, put } from "@vercel/blob";
import type { StoreData } from "./types";

const CONFIG_PATHNAME = "config.json";

let cachedConfigUrl: string | null = null;

async function findConfigUrl(): Promise<string | null> {
  if (cachedConfigUrl) return cachedConfigUrl;
  const { blobs } = await list({ prefix: CONFIG_PATHNAME, limit: 1 });
  const match = blobs.find((blob) => blob.pathname === CONFIG_PATHNAME);
  if (match) cachedConfigUrl = match.url;
  return match?.url ?? null;
}

export async function readStore(): Promise<StoreData> {
  const url = await findConfigUrl();
  if (!url) return { images: [], screens: [] };

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { images: [], screens: [] };

  const data = (await res.json()) as Partial<StoreData>;
  return { images: data.images ?? [], screens: data.screens ?? [] };
}

export async function writeStore(data: StoreData): Promise<void> {
  const blob = await put(CONFIG_PATHNAME, JSON.stringify(data, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  cachedConfigUrl = blob.url;
}
