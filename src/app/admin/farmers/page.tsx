"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { useDebounce } from "@/hooks/useDebounce";
import { PAGE_SIZE, type Farmer } from "@/types/admin";
import { TALUKA_OPTIONS } from "@/lib/constants";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric",
});

const INCOME_OPTIONS = ["agriculture", "business", "job", "other"];
const CLUSTER_OPTIONS = ["pulses", "cereals", "cash", "fruits", "vegs", "allied"];

interface FarmerForm {
  name: string;
  mobile: string;
  date_of_birth: string;
  village: string;
  taluka: string;
  district: string;
  income_source: string;
  cluster_type: string;
}

function toForm(f: Farmer): FarmerForm {
  return {
    name: f.name,
    mobile: f.mobile,
    date_of_birth: f.date_of_birth,
    village: f.village,
    taluka: f.taluka,
    district: f.district,
    income_source: f.income_source,
    cluster_type: f.cluster_type,
  };
}

export default function FarmersList() {
  const [rows, setRows] = useState<Farmer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  const [editTarget, setEditTarget] = useState<Farmer | null>(null);
  const [form, setForm] = useState<FarmerForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    });
    if (debouncedSearch) params.set("search", debouncedSearch);

    fetch(`/api/admin/farmers?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to fetch farmers");
        return response.json();
      })
      .then((data: { rows?: Farmer[]; total?: number }) => {
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to fetch farmers", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [page, debouncedSearch]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function openEdit(f: Farmer) {
    setEditTarget(f);
    setForm(toForm(f));
    setFormError("");
  }

  function closeEdit() {
    setEditTarget(null);
    setForm(null);
    setFormError("");
  }

  async function handleDelete(f: Farmer) {
    if (!confirm(`Delete farmer "${f.name}" (${f.mobile})? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/farmers/${f.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to delete farmer");
        return;
      }
      setLoading(true);
      setRows((current) => current.filter((row) => row.id !== f.id));
      setTotal((current) => Math.max(0, current - 1));
    } catch {
      alert("Connection error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!editTarget || !form) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch(`/api/admin/farmers/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || "Failed to update farmer");
        return;
      }
      closeEdit();
      setLoading(true);
      const controller = new AbortController();
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      fetch(`/api/admin/farmers?${params}`, { signal: controller.signal, cache: "no-store" })
        .then((r) => r.json())
        .then((data: { rows?: Farmer[]; total?: number }) => {
          setRows(data.rows ?? []);
          setTotal(data.total ?? 0);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } catch {
      setFormError("Connection error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell>
      <div className="admin-list-page">
        <div className="admin-filters">
          <input
            type="text"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={(e) => { setLoading(true); setSearch(e.target.value); setPage(0); }}
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr><td colSpan={7} className="admin-empty">No farmers found</td></tr>
              ) : (
                rows.map((f) => (
                  <tr key={f.id}>
                    <td className="admin-td-name">{f.name}</td>
                    <td>{f.mobile}</td>
                    <td>{f.village}</td>
                    <td className="admin-td-capitalize">{f.taluka}</td>
                    <td className="admin-td-capitalize">{f.cluster_type}</td>
                    <td className="admin-td-date">{dateFormatter.format(new Date(f.created_at))}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openEdit(f)}>Edit</button>
                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(f)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="admin-pagination">
            <button disabled={page === 0} onClick={() => { setLoading(true); setPage((p) => p - 1); }} className="admin-btn admin-btn-sm">
              ← Previous
            </button>
            <span className="admin-page-info">Page {page + 1} of {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => { setLoading(true); setPage((p) => p + 1); }} className="admin-btn admin-btn-sm">
              Next →
            </button>
          </div>
        )}
      </div>

      {editTarget && form && (
        <div className="admin-modal-overlay" onClick={closeEdit}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Farmer</h2>

            <div className="admin-field">
              <label htmlFor="fm-name">Full Name</label>
              <input type="text" id="fm-name" value={form.name} onChange={(e) => setForm((s) => ({ ...s!, name: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="fm-mobile">Mobile</label>
              <input type="text" id="fm-mobile" value={form.mobile} onChange={(e) => setForm((s) => ({ ...s!, mobile: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="fm-dob">Date of Birth</label>
              <input type="date" id="fm-dob" value={form.date_of_birth} onChange={(e) => setForm((s) => ({ ...s!, date_of_birth: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="fm-village">Village</label>
              <input type="text" id="fm-village" value={form.village} onChange={(e) => setForm((s) => ({ ...s!, village: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="fm-taluka">Taluka</label>
              <select id="fm-taluka" className="admin-select" style={{ width: "100%" }} value={form.taluka} onChange={(e) => setForm((s) => ({ ...s!, taluka: e.target.value }))}>
                {TALUKA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="fm-district">District</label>
              <input type="text" id="fm-district" value={form.district} onChange={(e) => setForm((s) => ({ ...s!, district: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="fm-income">Income Source</label>
              <select id="fm-income" className="admin-select" style={{ width: "100%" }} value={form.income_source} onChange={(e) => setForm((s) => ({ ...s!, income_source: e.target.value }))}>
                {INCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="fm-cluster">Cluster Type</label>
              <select id="fm-cluster" className="admin-select" style={{ width: "100%" }} value={form.cluster_type} onChange={(e) => setForm((s) => ({ ...s!, cluster_type: e.target.value }))}>
                {CLUSTER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {formError && <p className="admin-error">{formError}</p>}

            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-outline" onClick={closeEdit} disabled={saving}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
