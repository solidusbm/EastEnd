import crypto from "crypto";
import { clearCanvaTokens, readCanvaTokens, writeCanvaTokens, type CanvaTokens } from "./canvaTokens";
import { readSettings } from "./settings";

// Canva Connect API — see https://www.canva.dev/docs/connect/
const AUTHORIZE_URL = "https://www.canva.com/api/oauth/authorize";
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const API_BASE = "https://api.canva.com/rest/v1";
const SCOPES = "design:meta:read design:content:read";

// Access tokens are refreshed a bit before their real expiry to avoid a
// request racing the exact expiry instant.
const EXPIRY_SAFETY_MARGIN_MS = 60_000;

export interface CanvaConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export async function getCanvaConfig(): Promise<CanvaConfig | null> {
  const settings = await readSettings();
  const clientId = settings.canvaClientId || process.env.CANVA_CLIENT_ID;
  const clientSecret = settings.canvaClientSecret || process.env.CANVA_CLIENT_SECRET;
  const redirectUri = settings.canvaRedirectUri || process.env.CANVA_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export async function isCanvaConfigured(): Promise<boolean> {
  return (await getCanvaConfig()) !== null;
}

export async function isCanvaConnected(): Promise<boolean> {
  return (await readCanvaTokens()) !== null;
}

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

export interface PkceChallenge {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export function createPkceChallenge(): PkceChallenge {
  const state = base64url(crypto.randomBytes(24));
  const codeVerifier = base64url(crypto.randomBytes(64));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  return { state, codeVerifier, codeChallenge };
}

export function buildAuthorizationUrl(config: CanvaConfig, pkce: PkceChallenge): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: SCOPES,
    state: pkce.state,
    code_challenge: pkce.codeChallenge,
    code_challenge_method: "S256",
    response_type: "code",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

function basicAuthHeader(config: CanvaConfig): string {
  return "Basic " + Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function requestTokens(config: CanvaConfig, body: URLSearchParams): Promise<CanvaTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(config),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canva token request failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as TokenResponse;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function exchangeCodeForTokens(
  config: CanvaConfig,
  code: string,
  codeVerifier: string
): Promise<CanvaTokens> {
  const tokens = await requestTokens(
    config,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      redirect_uri: config.redirectUri,
    })
  );
  await writeCanvaTokens(tokens);
  return tokens;
}

export async function disconnectCanva(): Promise<void> {
  await clearCanvaTokens();
}

/** Returns a currently-valid access token, refreshing it first if needed. Null if not connected. */
export async function getValidAccessToken(): Promise<string | null> {
  const config = await getCanvaConfig();
  if (!config) return null;

  const tokens = await readCanvaTokens();
  if (!tokens) return null;

  if (Date.now() < tokens.expiresAt - EXPIRY_SAFETY_MARGIN_MS) {
    return tokens.accessToken;
  }

  const refreshed = await requestTokens(
    config,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    })
  );
  await writeCanvaTokens(refreshed);
  return refreshed.accessToken;
}

interface CanvaDesign {
  id: string;
  title: string;
  updatedAt: number;
}

export async function getDesignMetadata(accessToken: string, designId: string): Promise<CanvaDesign> {
  const res = await fetch(`${API_BASE}/designs/${encodeURIComponent(designId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canva get-design failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    design: { id: string; title: string; updated_at: number };
  };
  return { id: data.design.id, title: data.design.title, updatedAt: data.design.updated_at };
}

interface ExportJob {
  id: string;
  status: "in_progress" | "success" | "failed";
  urls?: string[];
  error?: { code: string; message: string };
}

async function createExportJob(accessToken: string, designId: string): Promise<ExportJob> {
  const res = await fetch(`${API_BASE}/exports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ design_id: designId, format: { type: "png" } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canva create-export failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { job: ExportJob };
  return data.job;
}

async function getExportJob(accessToken: string, exportId: string): Promise<ExportJob> {
  const res = await fetch(`${API_BASE}/exports/${encodeURIComponent(exportId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Canva get-export failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { job: ExportJob };
  return data.job;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Exports a Canva design as PNG and returns the raw file bytes. */
export async function exportDesignPng(accessToken: string, designId: string): Promise<Buffer> {
  let job = await createExportJob(accessToken, designId);

  const pollIntervalsMs = [1000, 1000, 2000, 2000, 3000, 3000, 5000, 5000, 5000, 5000];
  for (const delay of pollIntervalsMs) {
    if (job.status !== "in_progress") break;
    await sleep(delay);
    job = await getExportJob(accessToken, job.id);
  }

  if (job.status === "failed") {
    throw new Error(`Canva export failed: ${job.error?.message ?? "unknown error"}`);
  }
  if (job.status === "in_progress") {
    throw new Error("Canva export timed out waiting for the job to finish.");
  }
  const url = job.urls?.[0];
  if (!url) {
    throw new Error("Canva export succeeded but returned no download URL.");
  }

  const fileRes = await fetch(url);
  if (!fileRes.ok) {
    throw new Error(`Failed to download exported Canva file (${fileRes.status}).`);
  }
  return Buffer.from(await fileRes.arrayBuffer());
}

/** Accepts a full Canva design URL or a bare design ID and returns the design ID. */
export function parseCanvaDesignId(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/canva\.com\/design\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}

export interface CanvaImageFetch {
  buffer: Buffer;
  /** ISO timestamp of the design's last edit, per Canva's updated_at. */
  designUpdatedAt: string;
  designTitle: string;
}

/** Fetches the current metadata + rendered PNG for a design in one call. */
export async function fetchCanvaImage(accessToken: string, designId: string): Promise<CanvaImageFetch> {
  const design = await getDesignMetadata(accessToken, designId);
  const buffer = await exportDesignPng(accessToken, designId);
  return {
    buffer,
    designUpdatedAt: new Date(design.updatedAt * 1000).toISOString(),
    designTitle: design.title,
  };
}
