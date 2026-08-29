import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const data = await callRpc("admin_get_registration", { p_id: id });
    if (!data) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return Response.json(data);
  } catch (err) {
    console.error("[admin/registrations] detail error", err);
    return Response.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { action: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { action, notes } = body;

  try {
    if (action === "approve") {
      const result = await callRpc("admin_approve_registration", {
        p_id: id,
        p_notes: notes || null,
      });
      return Response.json(result);
    } else if (action === "reject") {
      const result = await callRpc("admin_reject_registration", {
        p_id: id,
        p_notes: notes || null,
      });
      return Response.json(result);
    } else {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err) {
    console.error("[admin/registrations] action error", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 }
    );
  }
}
