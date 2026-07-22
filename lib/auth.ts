import { randomBytes, scryptSync, timingSafeEqual as nodeTimingSafeEqual } from "crypto";
import { readSettings, writeSettings } from "./settings";

export const SESSION_COOKIE_NAME = "admin_session";

const SESSION_PAYLOAD = "eastend-admin-authenticated";
const SCRYPT_KEY_LENGTH = 64;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return nodeTimingSafeEqual(candidate, expected);
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return nodeTimingSafeEqual(bufA, bufB);
}

/** Whether an admin account exists yet -- via first-launch Setup or the legacy ADMIN_PASSWORD env var. */
export async function hasAdminPassword(): Promise<boolean> {
  const settings = await readSettings();
  return Boolean(settings.adminPasswordHash || process.env.ADMIN_PASSWORD);
}

/**
 * Sets (or replaces) the admin password, stored as a salted hash in
 * data/settings.json. Once set this way, it takes priority over the
 * ADMIN_PASSWORD env var (which still works as a fallback if this was never
 * used, e.g. an existing .env.local-based install).
 */
export async function setAdminPassword(password: string): Promise<void> {
  await writeSettings({ adminPasswordHash: hashPassword(password) });
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const settings = await readSettings();
  if (settings.adminPasswordHash) {
    return verifyPasswordHash(password, settings.adminPasswordHash);
  }
  if (process.env.ADMIN_PASSWORD) {
    return timingSafeStringEqual(password, process.env.ADMIN_PASSWORD);
  }
  return false;
}

async function hmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// The session token is an HMAC keyed on the current password's stored
// representation (hash, or the raw env var as a legacy fallback) -- so
// changing the password naturally invalidates every existing session.
async function getSessionSecret(): Promise<string | null> {
  const settings = await readSettings();
  return settings.adminPasswordHash || process.env.ADMIN_PASSWORD || null;
}

export async function createSessionToken(): Promise<string | null> {
  const secret = await getSessionSecret();
  if (!secret) return null;
  return hmac(secret, SESSION_PAYLOAD);
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const expected = await createSessionToken();
  if (!expected) return false;
  return timingSafeStringEqual(token, expected);
}
