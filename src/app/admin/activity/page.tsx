"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { useDebounce } from "@/hooks/useDebounce";
import { PAGE_SIZE, type AuditLogEntry } from "@/types/admin";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "login", label: "Login" },
  { value: "login_failed", label: "Login Failed" },
  { value: "approve_registration", label: "Approve Registration" },
  { value: "reject_registration", label: "Reject Registration" },
  { value: "create_admin", label: "Create Admin" },
  { value: "edit_admin", label: "Edit Admin" },
  { value: "deactivate_admin", label: "Deactivate Admin" },
  { value: "reset_admin_password", label: "Reset Password" },
];

function actionLabel(action: string): string {
  return ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action.replace(/_/g, " ");
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<AdminShell><div className="admin-loading">Loading...</div></AdminShell>}>
      <ActivityList />
    </Suspense>
  );
}

function ActivityList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState(searchParams.get("action") || "");
  const [username, setUsername] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedUsername = useDebounce(username);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (action) params.set("action", action);
    if (debouncedUsername) params.set("username", debouncedUsername);
    if (from) params.set("from", `${from}T00:00:00.000Z`);
    if (to) params.set("to", `${to}T23:59:59.999Z`);

    fetch(`/api/admin/activity?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.status === 403) {
          router.push("/admin");
          return null;
        }
        if (!res.ok) throw new Error("Failed to fetch activity");
        return res.json();
      })
      .then((data: { rows?: AuditLogEntry[]; total?: number } | null) => {
        if (!data) return;
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch activity", err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, action, debouncedUsername, from, to, router]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AdminShell>
      <div className="admin-list-page">
        <div className="admin-filters">
          <input
            type="text"
            placeholder="Filter by admin username..."
            value={username}
            onChange={(e) => { setLoading(true); setUsername(e.target.value); setPage(0); }}
            className="admin-search-input"
          />
          <select
            value={action}
            onChange={(e) => { setLoading(true); setAction(e.target.value); setPage(0); }}
            className="admin-select"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={(e) => { setLoading(true); setFrom(e.target.value); setPage(0); }}
            className="admin-select"
          />
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={(e) => { setLoading(true); setTo(e.target.value); setPage(0); }}
            className="admin-select"
          />
        </div>

        <div className="admin-results-info">
          {loading ? "Loading..." : `${total} entr${total !== 1 ? "ies" : "y"} found`}
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr><td colSpan={5} className="admin-empty">No activity found</td></tr>
              ) : (
                rows.map((entry) => (
                  <tr key={entry.id}>
                    <td className="admin-td-name">{entry.admin_username}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${entry.action.includes("fail") ? "rejected" : entry.action.includes("login") ? "pending" : "approved"}`}>
                        {actionLabel(entry.action)}
                      </span>
                    </td>
                    <td className="admin-td-capitalize">
                      {entry.target_table ? `${entry.target_table.replace(/_/g, " ")}` : "—"}
                    </td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".82rem", color: "#94a3b8" }}>
                      {entry.details && Object.keys(entry.details).length > 0
                        ? Object.entries(entry.details)
                            .filter(([, v]) => v != null)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(", ")
                        : "—"}
                    </td>
                    <td className="admin-td-date">
                      {dateFormatter.format(new Date(entry.created_at))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="admin-pagination">
            <button
              disabled={page === 0}
              onClick={() => { setLoading(true); setPage((p) => p - 1); }}
              className="admin-btn admin-btn-sm"
            >
              ← Previous
            </button>
            <span className="admin-page-info">Page {page + 1} of {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => { setLoading(true); setPage((p) => p + 1); }}
              className="admin-btn admin-btn-sm"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
