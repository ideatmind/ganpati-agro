import { NextRequest } from "next/server";
import {
  verifyPassword,
  createSessionCookie,
  clearSessionCookie,
} from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.password || !verifyPassword(body.password)) {
    return Response.json({ error: "Invalid password" }, { status: 401 });
  }

  const cookie = await createSessionCookie();
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
