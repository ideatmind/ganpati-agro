import { NextRequest } from "next/server";
import { callRpc } from "@/lib/supabase";
import { ADMIN_NO_STORE_HEADERS, isAuthError, parseSearch, requireAdmin } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

const EXPORT_BATCH_SIZE = 100;
type CsvRow = Record<string, unknown>;

/**
 * CSV export endpoint for registrations or farmers.
 * Usage: GET /api/admin/export?type=registrations&status=pending
 *        GET /api/admin/export?type=farmers
 */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (isAuthError(admin)) return admin;
  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") || "registrations";

  try {
    if (type === "farmers") {
      return csvDownload(
        "farmers",
        [
        "name", "mobile", "date_of_birth", "village", "taluka",
        "district", "income_source", "cluster_type", "created_at",
        ],
        (offset) => callRpc<CsvRow[]>("admin_export_farmers", {
          p_admin_id: admin.id,
          p_limit: EXPORT_BATCH_SIZE,
          p_offset: offset,
          p_search: parseSearch(sp) ?? null,
        })
      );
    }

    const params: Record<string, unknown> = {
      p_admin_id: admin.id,
      p_search: parseSearch(sp) ?? null,
      p_taluka: sp.get("taluka") || null,
    };
    const status = sp.get("status");
    if (status) params.p_status = status;

    return csvDownload(
      "registrations",
      [
        "name", "mobile", "date_of_birth", "village", "taluka",
        "district", "income_source", "cluster_type", "status", "created_at",
      ],
      (offset) => callRpc<CsvRow[]>("admin_export_registrations", {
        ...params,
        p_limit: EXPORT_BATCH_SIZE,
        p_offset: offset,
      })
    );
  } catch (err) {
    console.error("[admin/export] error", err);
    return Response.json(
      { error: "Export failed" },
      { status: 500, headers: ADMIN_NO_STORE_HEADERS }
    );
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function csvDownload(
  type: "farmers" | "registrations",
  columns: string[],
  getPage: (offset: number) => Promise<CsvRow[]>
): Response {
  const encoder = new TextEncoder();
  let offset = 0;
  let headerSent = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!headerSent) {
        headerSent = true;
        controller.enqueue(encoder.encode(`${columns.join(",")}\n`));
        return;
      }

      try {
        const rows = await getPage(offset);
        if (rows.length === 0) {
          controller.close();
          return;
        }

        offset += rows.length;
        controller.enqueue(encoder.encode(rows.map((row) => toCsvRow(row, columns)).join("")));
        if (rows.length < EXPORT_BATCH_SIZE) controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...ADMIN_NO_STORE_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}_${today()}.csv"`,
    },
  });
}

function toCsvRow(row: CsvRow, columns: string[]): string {
  return `${columns.map((column) => escapeCsv(row[column])).join(",")}\n`;
}

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}
