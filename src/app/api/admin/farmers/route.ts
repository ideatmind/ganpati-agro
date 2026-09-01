import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";
import {
  ADMIN_NO_STORE_HEADERS,
  isAuthError,
  parsePagination,
  parseSearch,
  requireAdmin,
} from "@/lib/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (isAuthError(admin)) return admin;
  const sp = request.nextUrl.searchParams;
  const { limit, offset } = parsePagination(sp);
  const params: Record<string, unknown> = {
    p_admin_id: admin.id,
    p_limit: limit,
    p_offset: offset,
  };
  const search = parseSearch(sp);
  if (search) params.p_search = search;

  try {
    const data = await callRpc("admin_list_farmers", params);
    return Response.json(data, { headers: ADMIN_NO_STORE_HEADERS });
  } catch (err) {
    console.error("[admin/farmers] list error", err);
    return Response.json(
      { error: "Failed to fetch" },
      { status: 500, headers: ADMIN_NO_STORE_HEADERS }
    );
  }
}
