import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requiredEnv } from "@/server/env";

function signature(payload: string, purpose: string) {
  const secret = requiredEnv("SESSION_SECRET");
  if (Buffer.byteLength(secret) < 32) throw new Error("Session secret must be at least 32 bytes");
  return createHmac("sha256", secret).update(`${purpose}:${payload}`).digest("base64url");
}
export function createToken(id: string, purpose: string, maxAge: number) {
  const payload = Buffer.from(JSON.stringify({ id, exp: Date.now() + maxAge * 1000 })).toString("base64url");
  return `${payload}.${signature(payload, purpose)}`;
}
export function readToken(value: string | undefined, purpose: string): string | null {
  if (!value || value.length > 1024) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, received] = parts;
  const expected = Buffer.from(signature(payload, purpose));
  const actual = Buffer.from(received);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!parsed || typeof parsed !== "object" || !("id" in parsed) || !("exp" in parsed)) return null;
    if (typeof parsed.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parsed.id)) return null;
    return typeof parsed.exp === "number" && Number.isFinite(parsed.exp) && Date.now() < parsed.exp ? parsed.id : null;
  } catch { return null; }
}
