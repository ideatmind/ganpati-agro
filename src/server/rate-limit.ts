const windows = new Map<string, number[]>();

export function rateLimited(key: string, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const active = (windows.get(key) ?? []).filter((time) => now - time < windowMs);
  if (active.length >= limit) return true;
  windows.set(key, [...active, now]);
  if (windows.size > 5_000) for (const [entry, times] of windows) if (!times.some((time) => now - time < windowMs)) windows.delete(entry);
  return false;
}

export function clientIp(headers: Headers) { return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"; }
