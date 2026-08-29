/**
 * Admin session helpers (server-only).
 *
 * Uses HMAC-SHA256 signed cookies for session verification.
 * No external dependencies — uses Web Crypto API.
 */

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? "";
const COOKIE_NAME = "ga_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours

async function hmacSign(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(payload);
  return expected === signature;
}

export function isConfigured(): boolean {
  return ADMIN_PASSWORD.length > 0;
}

export function verifyPassword(password: string): boolean {
  if (!isConfigured()) return false;
  return password === ADMIN_PASSWORD;
}

export async function createSessionCookie(): Promise<string> {
  const expires = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = `admin:${expires}`;
  const sig = await hmacSign(payload);
  const value = `${payload}.${sig}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_MAX_AGE}`;
}

export async function verifySession(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue || !isConfigured()) return false;
  const lastDot = cookieValue.lastIndexOf(".");
  if (lastDot === -1) return false;

  const payload = cookieValue.slice(0, lastDot);
  const sig = cookieValue.slice(lastDot + 1);

  if (!(await hmacVerify(payload, sig))) return false;

  const parts = payload.split(":");
  if (parts.length !== 2) return false;
  const expires = parseInt(parts[1], 10);
  return !isNaN(expires) && Date.now() < expires;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export { COOKIE_NAME };
