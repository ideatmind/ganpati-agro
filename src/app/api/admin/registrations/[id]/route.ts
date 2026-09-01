import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { callRpc } from "@/lib/supabase";
import { ADMIN_NO_STORE_HEADERS, isAuthError, requireAdmin } from "@/lib/admin-request";
import { DASHBOARD_STATS_TAG } from "@/lib/admin-cache";
import { TALUKA_VALUES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const INCOME_SOURCES = ["agriculture", "business", "job", "other"];
const CLUSTER_TYPES = ["pulses", "cereals", "cash", "fruits", "vegs", "allied"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (isAuthError(admin)) return admin;
  const { id } = await params;
  try {
    const data = await callRpc("admin_get_registration", { p_admin_id: admin.id, p_id: id });
    if (!data) {
      return Response.json(
        { error: "Not found" },
        { status: 404, headers: ADMIN_NO_STORE_HEADERS }
      );
    }
    return Response.json(data, { headers: ADMIN_NO_STORE_HEADERS });
  } catch (err) {
    console.error("[admin/registrations] detail error", err);
    return Response.json(
      { error: "Failed to fetch" },
      { status: 500, headers: ADMIN_NO_STORE_HEADERS }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (isAuthError(admin)) return admin;
  const { id } = await params;
  let body: { action: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request" },
      { status: 400, headers: ADMIN_NO_STORE_HEADERS }
    );
  }

  const { action, notes } = body;

  try {
    if (action === "approve") {
      const result = await callRpc("admin_approve_registration", {
        p_admin_id: admin.id,
        p_id: id,
        p_notes: notes || null,
      });
      revalidateTag(DASHBOARD_STATS_TAG, "max");
      return Response.json(result, { headers: ADMIN_NO_STORE_HEADERS });
    } else if (action === "reject") {
      const result = await callRpc("admin_reject_registration", {
        p_admin_id: admin.id,
        p_id: id,
        p_notes: notes || null,
      });
      revalidateTag(DASHBOARD_STATS_TAG, "max");
      return Response.json(result, { headers: ADMIN_NO_STORE_HEADERS });
    } else if (action === "edit") {
      const fields = parseRegistrationEdit(body);
      if ("error" in fields) {
        return Response.json({ error: fields.error }, { status: 400, headers: ADMIN_NO_STORE_HEADERS });
      }
      const result = await callRpc("admin_edit_registration", {
        p_admin_id: admin.id,
        p_id: id,
        p_name: fields.name,
        p_mobile: fields.mobile,
        p_date_of_birth: fields.date_of_birth,
        p_village: fields.village,
        p_taluka: fields.taluka,
        p_district: fields.district,
        p_income_source: fields.income_source,
        p_cluster_type: fields.cluster_type,
      });
      revalidateTag(DASHBOARD_STATS_TAG, "max");
      return Response.json(result, { headers: ADMIN_NO_STORE_HEADERS });
    } else {
      return Response.json(
        { error: "Invalid action" },
        { status: 400, headers: ADMIN_NO_STORE_HEADERS }
      );
    }
  } catch (err) {
    console.error("[admin/registrations] action error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 500, headers: ADMIN_NO_STORE_HEADERS }
    );
  }
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length >= 1 && v.length <= max ? v : null;
}

function parseRegistrationEdit(
  body: Record<string, unknown>
): Record<string, string> | { error: string } {
  const name = cleanText(body.name, 200);
  const village = cleanText(body.village, 200);
  const district = cleanText(body.district, 200);
  if (!name || !village || !district) return { error: "Name, village and district are required" };
  if (typeof body.mobile !== "string" || !/^[0-9]{10}$/.test(body.mobile.trim())) return { error: "Invalid mobile number" };
  if (typeof body.date_of_birth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date_of_birth)) return { error: "Invalid date of birth" };
  if (typeof body.taluka !== "string" || !TALUKA_VALUES.includes(body.taluka)) return { error: "Invalid taluka" };
  if (typeof body.income_source !== "string" || !INCOME_SOURCES.includes(body.income_source)) return { error: "Invalid income source" };
  if (typeof body.cluster_type !== "string" || !CLUSTER_TYPES.includes(body.cluster_type)) return { error: "Invalid cluster type" };
  return {
    name, village, district,
    mobile: body.mobile.trim(),
    date_of_birth: body.date_of_birth,
    taluka: body.taluka,
    income_source: body.income_source,
    cluster_type: body.cluster_type,
  };
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (isAuthError(admin)) return admin;
  const { id } = await params;

  try {
    const result = await callRpc("admin_delete_registration", { p_admin_id: admin.id, p_id: id });
    revalidateTag(DASHBOARD_STATS_TAG, "max");
    return Response.json(result, { headers: ADMIN_NO_STORE_HEADERS });
  } catch (err) {
    console.error("[admin/registrations] delete error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to delete registration" },
      { status: 400, headers: ADMIN_NO_STORE_HEADERS }
    );
  }
}
