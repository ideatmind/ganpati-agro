import "server-only";
import { createHmac } from "node:crypto";
import { callRpc } from "@/server/database";
import { requiredEnv } from "@/server/env";
import { AppError } from "@/shared/errors";
export async function enforceLimit(key: string, limit = 5, windowSeconds = 60) {
  const hash = rateLimitKey(key);
  const allowed = await callRpc<boolean>('consume_rate_limit', {p_key:hash,p_limit:limit,p_window_seconds:windowSeconds});
  if (!allowed) throw new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a minute.');
}
export function rateLimitKey(key:string){return createHmac('sha256',requiredEnv('SESSION_SECRET')).update(key).digest('hex');}
export function clientIp(headers: Headers) {
  // Only trust a header explicitly guaranteed to be overwritten by the deployment proxy.
  const header = process.env.TRUSTED_CLIENT_IP_HEADER;
  return header ? headers.get(header)?.split(',')[0]?.trim().slice(0,64) || 'unknown' : 'unknown';
}
