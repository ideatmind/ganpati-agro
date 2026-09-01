/** Server-only HMAC session helpers for the multi-admin dashboard. */

export type AdminRole = "super_admin" | "admin";

export interface AdminIdentity {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
}

const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
const COOKIE_NAME = "ga_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24;

if (!SESSION_SECRET) {
  throw new Error("ADMIN_SESSION_SECRET must be configured; it cannot fall back to an admin password.");
}

function encode(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decode(value: string): string | null {
  try {
    const base64 = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
    return new TextDecoder().decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)));
  } catch {
    return null;
  }
}

async function signingKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function hmacSign(payload: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(payload));
  return encode(String.fromCharCode(...new Uint8Array(signature)));
}

async function hmacVerify(payload: string, signature: string): Promise<boolean> {
  const rawSignature = decode(signature);
  if (rawSignature === null) return false;
  // Web Crypto performs the signature comparison internally; this avoids a
  // timing-sensitive JavaScript string comparison.
  return crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    Uint8Array.from(rawSignature, (char) => char.charCodeAt(0)),
    new TextEncoder().encode(payload)
  );
}

export async function createSessionCookie(identity: AdminIdentity): Promise<string> {
  const payload = encode(JSON.stringify({ ...identity, expires: Date.now() + SESSION_MAX_AGE * 1000 }));
  const signature = await hmacSign(payload);
  return `${COOKIE_NAME}=${payload}.${signature}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_MAX_AGE}`;
}

export async function verifySession(cookieValue: string | undefined): Promise<AdminIdentity | null> {
  if (!cookieValue) return null;
  const separator = cookieValue.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = cookieValue.slice(0, separator);
  if (!(await hmacVerify(payload, cookieValue.slice(separator + 1)))) return null;

  try {
    const decoded = decode(payload);
    if (!decoded) return null;
    const parsed = JSON.parse(decoded) as Partial<AdminIdentity & { expires: number }>;
    if (
      typeof parsed.id !== "string" || typeof parsed.username !== "string" ||
      typeof parsed.displayName !== "string" ||
      (parsed.role !== "admin" && parsed.role !== "super_admin") ||
      typeof parsed.expires !== "number" || Date.now() >= parsed.expires
    ) return null;
    return { id: parsed.id, username: parsed.username, displayName: parsed.displayName, role: parsed.role };
  } catch {
    return null;
  }
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`;
}

export { COOKIE_NAME };
