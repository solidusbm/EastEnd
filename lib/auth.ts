export const SESSION_COOKIE_NAME = "admin_session";

const SESSION_PAYLOAD = "eastend-admin-authenticated";

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

export async function createSessionToken(): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  return hmac(secret, SESSION_PAYLOAD);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || !process.env.ADMIN_PASSWORD) return false;
  const expected = await createSessionToken();
  return timingSafeEqual(token, expected);
}
