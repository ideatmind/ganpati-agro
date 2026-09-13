import { clearSession } from "@/server/session";

export async function POST() {
  await clearSession();
  return Response.json({ data: { ok: true } });
}
