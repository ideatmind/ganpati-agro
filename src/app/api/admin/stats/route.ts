import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";

export async function GET() {
  try {
    const stats = await callRpc<{
      registrations: Record<string, number>;
      by_taluka: Record<string, number>;
      total_farmers: number;
    }>("admin_dashboard_stats", {});
    return Response.json(stats);
  } catch (err) {
    console.error("[admin/stats] error", err);
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
