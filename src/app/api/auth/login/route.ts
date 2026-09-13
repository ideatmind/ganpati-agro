import { z } from "zod";
import { callRpc } from "@/server/database";
import { clientIp, rateLimited } from "@/server/rate-limit";
import { setSession, type Identity } from "@/server/session";

const schema = z.object({ mobile: z.string().regex(/^\d{10}$/), password: z.string().min(8).max(128) });

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  try {
    const body = schema.parse(await request.json());
    if (rateLimited(`login:${ip}:${body.mobile}`, 5, 60_000)) return Response.json({ error: "Too many login attempts" }, { status: 429 });
    const identity = await callRpc<Identity | null>("authenticate_account", { p_mobile: body.mobile, p_password: body.password });
    if (!identity) return Response.json({ error: "Invalid mobile number or password" }, { status: 401 });
    await setSession(identity);
    return Response.json({ data: identity });
  } catch { return Response.json({ error: "Invalid mobile number or password" }, { status: 401 }); }
}
