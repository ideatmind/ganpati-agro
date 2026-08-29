import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const params: Record<string, unknown> = {
    p_limit: parseInt(sp.get("limit") || "20", 10),
    p_offset: parseInt(sp.get("offset") || "0", 10),
  };
  const status = sp.get("status");
  const taluka = sp.get("taluka");
  const search = sp.get("search");
  if (status) params.p_status = status;
  if (taluka) params.p_taluka = taluka;
  if (search) params.p_search = search;

  try {
    const data = await callRpc("admin_list_registrations", params);
    return Response.json(data);
  } catch (err) {
    console.error("[admin/registrations] list error", err);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
