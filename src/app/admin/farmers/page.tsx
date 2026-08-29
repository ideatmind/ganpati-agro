"use client";

import { useEffect, useState, useCallback } from "react";
import AdminShell from "@/components/admin/AdminShell";

interface Farmer {
  id: string;
  name: string;
  mobile: string;
  date_of_birth: string;
  village: string;
  taluka: string;
  district: string;
  income_source: string;
  cluster_type: string;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function FarmersList() {
  const [rows, setRows] = useState<Farmer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    if (search) params.set("search", search);

    try {
      const res = await fetch(`/api/admin/farmers?${params}`);
      const data = await res.json();
      setRows(data.rows || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch farmers", err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

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
        <div className="admin-filters">
          <input
            type="text"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="admin-search-input"
          />
          <a href="/api/admin/export?type=farmers" className="admin-btn admin-btn-outline admin-btn-sm" download>
            Export CSV
          </a>
        </div>

        <div className="admin-results-info">
          {loading ? "Loading..." : `${total} farmer${total !== 1 ? "s" : ""} found`}
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Village</th>
                <th>Taluka</th>
                <th>Cluster</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr><td colSpan={6} className="admin-empty">No farmers found</td></tr>
              ) : (
                rows.map((f) => (
                  <tr key={f.id}>
                    <td className="admin-td-name">{f.name}</td>
                    <td>{f.mobile}</td>
                    <td>{f.village}</td>
                    <td className="admin-td-capitalize">{f.taluka}</td>
                    <td className="admin-td-capitalize">{f.cluster_type}</td>
                    <td className="admin-td-date">{formatDate(f.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="admin-pagination">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="admin-btn admin-btn-sm">
              ← Previous
            </button>
            <span className="admin-page-info">Page {page + 1} of {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="admin-btn admin-btn-sm">
              Next →
            </button>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
