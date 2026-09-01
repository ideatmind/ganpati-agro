import { NextRequest } from "next/server";
import {
  createSessionCookie,
  clearSessionCookie,
} from "@/lib/admin-auth";
import { callRpc } from "@/lib/supabase";
import { clientIp, createRateLimiter } from "@/lib/rate-limit";

const LOGIN_WINDOW_MS = 60 * 1000;
// One limiter throttles a single username across all source IPs; the other
// throttles a single source IP across all usernames.
const usernameRateLimiter = createRateLimiter(5, LOGIN_WINDOW_MS);
const ipRateLimiter = createRateLimiter(30, LOGIN_WINDOW_MS);

export async function POST(request: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const username = body.username?.trim().toLowerCase();
  if (!username || !body.password || username.length > 64 || body.password.length > 256) {
    return Response.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const ip = clientIp(request.headers);
  if (usernameRateLimiter.isLimited(username) || ipRateLimiter.isLimited(ip)) {
    return Response.json({ error: "Too many login attempts. Please try again shortly." }, { status: 429 });
  }

  const admin = await callRpc<{
    id: string; username: string; display_name: string; role: "admin" | "super_admin";
  } | null>("admin_authenticate", { p_username: username, p_password: body.password, p_ip: ip });
  if (!admin) return Response.json({ error: "Invalid username or password" }, { status: 401 });

  const cookie = await createSessionCookie({
    id: admin.id, username: admin.username, displayName: admin.display_name, role: admin.role,
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}

export async function DELETE() {
  const cookie = clearSessionCookie();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
}
