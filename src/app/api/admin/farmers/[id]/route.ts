import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { callRpc } from "@/lib/supabase";
import { ADMIN_NO_STORE_HEADERS, isAuthError, requireAdmin } from "@/lib/admin-request";
import { DASHBOARD_STATS_TAG } from "@/lib/admin-cache";
import { TALUKA_VALUES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const INCOME_SOURCES = ["agriculture", "business", "job", "other"];
const CLUSTER_TYPES = ["pulses", "cereals", "cash", "fruits", "vegs", "allied"];

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length >= 1 && v.length <= max ? v : null;
}

function parseFarmer(body: unknown): Record<string, unknown> | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request" };
  const p = body as Record<string, unknown>;
  const name = cleanText(p.name, 200);
  const village = cleanText(p.village, 200);
  const district = cleanText(p.district, 200);
  if (!name || !village || !district) return { error: "Name, village and district are required" };
  if (typeof p.mobile !== "string" || !/^[0-9]{10}$/.test(p.mobile.trim())) return { error: "Invalid mobile number" };
  if (typeof p.date_of_birth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.date_of_birth)) return { error: "Invalid date of birth" };
  if (typeof p.taluka !== "string" || !TALUKA_VALUES.includes(p.taluka)) return { error: "Invalid taluka" };
  if (typeof p.income_source !== "string" || !INCOME_SOURCES.includes(p.income_source)) return { error: "Invalid income source" };
  if (typeof p.cluster_type !== "string" || !CLUSTER_TYPES.includes(p.cluster_type)) return { error: "Invalid cluster type" };
  return {
    name, village, district,
    mobile: p.mobile.trim(),
    date_of_birth: p.date_of_birth,
    taluka: p.taluka,
    income_source: p.income_source,
    cluster_type: p.cluster_type,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (isAuthError(admin)) return admin;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400, headers: ADMIN_NO_STORE_HEADERS });
  }

  const fields = parseFarmer(body);
  if ("error" in fields) {
    return Response.json({ error: fields.error }, { status: 400, headers: ADMIN_NO_STORE_HEADERS });
  }

  try {
    const result = await callRpc("admin_edit_farmer", {
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
  } catch (err) {
    console.error("[admin/farmers] edit error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to update farmer" },
      { status: 400, headers: ADMIN_NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (isAuthError(admin)) return admin;
  const { id } = await params;

  try {
    const result = await callRpc("admin_delete_farmer", { p_admin_id: admin.id, p_id: id });
    revalidateTag(DASHBOARD_STATS_TAG, "max");
    return Response.json(result, { headers: ADMIN_NO_STORE_HEADERS });
  } catch (err) {
    console.error("[admin/farmers] delete error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to delete farmer" },
      { status: 400, headers: ADMIN_NO_STORE_HEADERS }
    );
  }
}
