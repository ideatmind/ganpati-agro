import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { callRpc } from "@/server/database";
import { requiredEnv } from "@/server/env";

export type Role = "farmer_referrer" | "employee" | "manager" | "super_admin";
export interface Identity { id: string; mobile: string; displayName: string; roles: Role[] }
const COOKIE = "ga_session";
const MAX_AGE = 60 * 60 * 12;

function sign(payload: string) { return createHmac("sha256", requiredEnv("SESSION_SECRET")).update(payload).digest("base64url"); }

export async function setSession(identity: Identity) {
  const payload = Buffer.from(JSON.stringify({ id: identity.id, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: MAX_AGE, path: "/" });
}

export async function clearSession() { (await cookies()).delete(COOKIE); }

export async function getIdentity(): Promise<Identity | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { id: string; exp: number };
    if (!parsed.id || Date.now() >= parsed.exp) return null;
    return await callRpc<Identity | null>("get_account_session", { p_account_id: parsed.id });
  } catch { return null; }
}

export async function requireIdentity(roles?: Role[]) {
  const identity = await getIdentity();
  if (!identity) return null;
  if (roles && !roles.some((role) => identity.roles.includes(role))) return null;
  return identity;
}
