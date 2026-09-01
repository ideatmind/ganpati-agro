import { NextRequest } from "next/server";
import { isAuthError, requireAdmin } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (isAuthError(admin)) return admin;
  return Response.json(admin, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
