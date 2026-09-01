/** Shared request guards for private admin endpoints. */
import type { NextRequest } from "next/server";
import { COOKIE_NAME, type AdminIdentity, verifySession } from "@/lib/admin-auth";
import { callRpc } from "@/lib/supabase";

const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;

export const ADMIN_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function requireAdmin(
  request: NextRequest,
  requiredRole: "admin" | "super_admin" = "admin"
): Promise<AdminIdentity | Response> {
  const identity = await verifySession(request.cookies.get(COOKIE_NAME)?.value);
  if (!identity) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: ADMIN_NO_STORE_HEADERS });
  }

  // Re-check against the accounts table so a deactivated admin cannot keep
  // using an unexpired signed cookie. This also refreshes role/display name.
  let active: AdminIdentity | null = null;
  try {
    const row = await callRpc<{
      id: string; username: string; display_name: string; role: AdminIdentity["role"];
    } | null>("admin_verify_session", { p_admin_id: identity.id });
    if (row) {
      active = {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        role: row.role,
      };
    }
  } catch (err) {
    console.error("[admin] session verification failed", err);
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: ADMIN_NO_STORE_HEADERS });
  }

  if (!active) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: ADMIN_NO_STORE_HEADERS });
  }
  if (requiredRole === "super_admin" && active.role !== "super_admin") {
    return Response.json({ error: "Forbidden" }, { status: 403, headers: ADMIN_NO_STORE_HEADERS });
  }
  return active;
}

export function isAuthError(value: AdminIdentity | Response): value is Response {
  return value instanceof Response;
}

function parseInteger(value: string | null, fallback: number): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export function parsePagination(searchParams: URLSearchParams) {
  return {
    limit: Math.max(1, Math.min(parseInteger(searchParams.get("limit"), 20), MAX_PAGE_SIZE)),
    offset: parseInteger(searchParams.get("offset"), 0),
  };
}

export function parseSearch(searchParams: URLSearchParams): string | undefined {
  const value = searchParams.get("search")?.trim();
  return value ? value.slice(0, MAX_SEARCH_LENGTH) : undefined;
}
