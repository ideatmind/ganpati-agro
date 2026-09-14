export function allowedMutation(request: Request, configuredOrigin?: string): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  try { return !!origin && origin === new URL(configuredOrigin || request.url).origin; }
  catch { return false; }
}
