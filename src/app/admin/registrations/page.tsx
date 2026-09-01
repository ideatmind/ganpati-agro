"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { useDebounce } from "@/hooks/useDebounce";
import {
  PAGE_SIZE,
  STATUS_OPTIONS,
  type Registration,
} from "@/types/admin";
import { ADMIN_TALUKA_OPTIONS } from "@/lib/constants";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric",
});

export default function RegistrationsPage() {
  return (
    <Suspense fallback={<AdminShell><div className="admin-loading">Loading...</div></AdminShell>}>
      <RegistrationsList />
    </Suspense>
  );
}

function RegistrationsList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [taluka, setTaluka] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (status) params.set("status", status);
    if (taluka) params.set("taluka", taluka);
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/admin/registrations?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to fetch registrations");
        return response.json();
      })
      .then((data: { rows?: Registration[]; total?: number }) => {
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to fetch registrations", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, status, taluka, debouncedSearch]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AdminShell>
      <div className="admin-list-page">
        {/* Filters */}
        <div className="admin-filters">
          <input
            type="text"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={(e) => { setLoading(true); setSearch(e.target.value); setPage(0); }}
            className="admin-search-input"
          />
          <select value={status} onChange={(e) => { setLoading(true); setStatus(e.target.value); setPage(0); }} className="admin-select">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={taluka} onChange={(e) => { setLoading(true); setTaluka(e.target.value); setPage(0); }} className="admin-select">
            {ADMIN_TALUKA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Results info */}
        <div className="admin-results-info">
          {loading ? "Loading..." : `${total} registration${total !== 1 ? "s" : ""} found`}
        </div>

        {/* Table */}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Village</th>
                <th>Taluka</th>
                <th>Cluster</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr><td colSpan={7} className="admin-empty">No registrations found</td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="admin-table-row" onClick={() => router.push(`/admin/registrations/${r.id}`)}>
                    <td className="admin-td-name">{r.name}</td>
                    <td>{r.mobile}</td>
                    <td>{r.village}</td>
                    <td className="admin-td-capitalize">{r.taluka}</td>
                    <td className="admin-td-capitalize">{r.cluster_type}</td>
                    <td><span className={`admin-badge admin-badge-${r.status}`}>{r.status}</span></td>
                    <td className="admin-td-date">{dateFormatter.format(new Date(r.created_at))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button
              disabled={page === 0}
              onClick={() => { setLoading(true); setPage((p) => p - 1); }}
              className="admin-btn admin-btn-sm"
            >
              ← Previous
            </button>
            <span className="admin-page-info">
              Page {page + 1} of {totalPages}
            </span>
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
