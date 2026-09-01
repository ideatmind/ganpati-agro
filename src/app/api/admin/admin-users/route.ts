import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";
import { ADMIN_NO_STORE_HEADERS, isAuthError, parsePagination, requireAdmin } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request, "super_admin");
  if (isAuthError(admin)) return admin;
  const { limit, offset } = parsePagination(request.nextUrl.searchParams);
  try {
    const data = await callRpc("admin_list_users", { p_admin_id: admin.id, p_limit: limit, p_offset: offset });
    return Response.json(data, { headers: ADMIN_NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: "Failed to load admin accounts" }, { status: 500, headers: ADMIN_NO_STORE_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request, "super_admin");
  if (isAuthError(admin)) return admin;
  try {
    const body = await request.json() as { username?: string; password?: string; displayName?: string; role?: string };
    if (!body.username || !body.password || !body.displayName) return Response.json({ error: "Username, password and display name are required" }, { status: 400, headers: ADMIN_NO_STORE_HEADERS });
    const user = await callRpc("admin_create_user", { p_admin_id: admin.id, p_username: body.username, p_password: body.password, p_display_name: body.displayName, p_role: body.role ?? "admin" });
    return Response.json(user, { status: 201, headers: ADMIN_NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: "Unable to create admin account" }, { status: 400, headers: ADMIN_NO_STORE_HEADERS });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin(request, "super_admin");
  if (isAuthError(admin)) return admin;
  try {
    const body = await request.json() as { id?: string; displayName?: string; role?: string; isActive?: boolean; password?: string };
    if (!body.id) return Response.json({ error: "Admin id is required" }, { status: 400, headers: ADMIN_NO_STORE_HEADERS });
    const user = await callRpc("admin_update_user", { p_admin_id: admin.id, p_target_id: body.id, p_display_name: body.displayName ?? null, p_role: body.role ?? null, p_is_active: typeof body.isActive === "boolean" ? body.isActive : null, p_password: body.password ?? null });
    return Response.json(user, { headers: ADMIN_NO_STORE_HEADERS });
  } catch {
    return Response.json({ error: "Unable to update admin account" }, { status: 400, headers: ADMIN_NO_STORE_HEADERS });
  }
}
