import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";
import { ADMIN_NO_STORE_HEADERS } from "@/lib/admin-request";
import { isAuthError, requireAdmin } from "@/lib/admin-request";
import { DASHBOARD_STATS_TAG } from "@/lib/admin-cache";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (isAuthError(admin)) return admin;
  try {
    const stats = await callRpc<{
      registrations: Record<string, number>;
      by_taluka: Record<string, number>;
      total_farmers: number;
    }>("admin_dashboard_stats", { p_admin_id: admin.id }, {
      // Dashboard aggregates are shared by all authenticated admins. Cache for
      // a short period and invalidate this tag immediately after mutations.
      next: { revalidate: 30, tags: [DASHBOARD_STATS_TAG] },
    });
    return Response.json(stats, { headers: ADMIN_NO_STORE_HEADERS });
  } catch (err) {
    console.error("[admin/stats] error", err);
    return Response.json(
      { error: "Failed to fetch stats" },
      { status: 500, headers: ADMIN_NO_STORE_HEADERS }
    );
  }
}
