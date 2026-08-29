import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * CSV export endpoint for registrations or farmers.
 * Usage: GET /api/admin/export?type=registrations&status=pending
 *        GET /api/admin/export?type=farmers
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") || "registrations";

  try {
    if (type === "farmers") {
      const data = await callRpc<{ rows: Record<string, unknown>[]; total: number }>(
        "admin_list_farmers",
        { p_limit: 10000, p_offset: 0 }
      );
      const csv = toCsv(data.rows, [
        "name", "mobile", "date_of_birth", "village", "taluka",
        "district", "income_source", "cluster_type", "created_at",
      ]);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="farmers_${today()}.csv"`,
        },
      });
    }

    // Default: registrations
    const params: Record<string, unknown> = { p_limit: 10000, p_offset: 0 };
    const status = sp.get("status");
    if (status) params.p_status = status;

    const data = await callRpc<{ rows: Record<string, unknown>[]; total: number }>(
      "admin_list_registrations",
      params
    );
    const csv = toCsv(data.rows, [
      "name", "mobile", "date_of_birth", "village", "taluka",
      "district", "income_source", "cluster_type", "status", "created_at",
    ]);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registrations_${today()}.csv"`,
      },
    });
  } catch (err) {
    console.error("[admin/export] error", err);
    return Response.json({ error: "Export failed" }, { status: 500 });
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const lines = rows.map((row) =>
    columns.map((col) => {
      const val = row[col];
      if (val == null) return "";
      const str = String(val);
      return str.includes(",") || str.includes('"') || str.includes("\n")
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(",")
  );
  return [header, ...lines].join("\n");
}
