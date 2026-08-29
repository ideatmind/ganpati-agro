"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";

interface Registration {
  id: string;
  name: string;
  mobile: string;
  village: string;
  taluka: string;
  cluster_type: string;
  status: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const TALUKA_OPTIONS = [
  { value: "", label: "All Talukas" },
  { value: "dharashiv", label: "Dharashiv" },
  { value: "tuljapur", label: "Tuljapur" },
  { value: "umarga", label: "Umarga" },
  { value: "lohara", label: "Lohara" },
  { value: "kalamb", label: "Kalamb" },
  { value: "washi", label: "Washi" },
  { value: "bhum", label: "Bhum" },
  { value: "paranda", label: "Paranda" },
];

const PAGE_SIZE = 20;

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    if (status) params.set("status", status);
    if (taluka) params.set("taluka", taluka);
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/admin/registrations?${params}`);
      const data = await res.json();
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch registrations", err);
    } finally {
      setLoading(false);
    }
  }, [page, status, taluka, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  }

  return (
    <AdminShell>
      <div className="admin-list-page">
        {/* Filters */}
        <div className="admin-filters">
          <input
            type="text"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="admin-search-input"
          />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="admin-select">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={taluka} onChange={(e) => { setTaluka(e.target.value); setPage(0); }} className="admin-select">
            {TALUKA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                    <td className="admin-td-date">{formatDate(r.created_at)}</td>
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
              onClick={() => setPage((p) => p - 1)}
              className="admin-btn admin-btn-sm"
            >
              ← Previous
            </button>
            <span className="admin-page-info">
              Page {page + 1} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
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
