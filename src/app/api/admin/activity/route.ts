import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";
import { ADMIN_NO_STORE_HEADERS, isAuthError, parsePagination, requireAdmin } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request, "super_admin");
  if (isAuthError(admin)) return admin;
  const query = request.nextUrl.searchParams;
  const { limit, offset } = parsePagination(query);
  try {
    const data = await callRpc("admin_list_audit_log", {
      p_admin_id: admin.id, p_username: query.get("username") || null,
      p_action: query.get("action") || null, p_from: query.get("from") || null,
      p_to: query.get("to") || null, p_limit: limit, p_offset: offset,
    });
    return Response.json(data, { headers: ADMIN_NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: "Failed to load activity" }, { status: 500, headers: ADMIN_NO_STORE_HEADERS });
  }
}
