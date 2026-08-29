import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const params: Record<string, unknown> = {
    p_limit: parseInt(sp.get("limit") || "20", 10),
    p_offset: parseInt(sp.get("offset") || "0", 10),
  };
  const search = sp.get("search");
  if (search) params.p_search = search;

  try {
    const data = await callRpc("admin_list_farmers", params);
    return Response.json(data);
  } catch (err) {
    console.error("[admin/farmers] list error", err);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
