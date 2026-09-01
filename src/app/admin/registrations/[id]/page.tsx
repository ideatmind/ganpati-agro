"use client";

import { use, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type RegistrationDetail } from "@/types/admin";
import { TALUKA_OPTIONS } from "@/lib/constants";

const INCOME_OPTIONS = ["agriculture", "business", "job", "other"];
const CLUSTER_OPTIONS = ["pulses", "cereals", "cash", "fruits", "vegs", "allied"];

interface EditForm {
  name: string;
  mobile: string;
  date_of_birth: string;
  village: string;
  taluka: string;
  district: string;
  income_source: string;
  cluster_type: string;
}

interface ReviewResult {
  status: RegistrationDetail["status"];
  reviewed_at: string;
  reviewer_notes: string | null;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export default function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<RegistrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState<"approve" | "reject" | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/registrations/${id}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("Failed to fetch registration");
        return response.json() as Promise<RegistrationDetail>;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to fetch registration", error);
        setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id]);

  async function handleAction(action: "approve" | "reject") {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes || undefined }),
      });
      if (res.ok) {
        const result = await res.json() as ReviewResult;
        // The RPC returns the only fields changed by a review, so updating the
        // local record avoids a second round trip and duplicate payload.
        setData((current) => current && {
          ...current,
          status: result.status,
          reviewed_at: result.reviewed_at,
          reviewer_notes: result.reviewer_notes,
        });
        setShowConfirm(null);
        setNotes("");
      } else {
        const err = await res.json();
        alert(err.error || "Action failed");
      }
    } catch {
      alert("Connection error");
    } finally {
      setActionLoading(false);
    }
  }

  function maskAadhar(aadhar: string) {
    if (aadhar.length !== 12) return aadhar;
    return "••••-••••-" + aadhar.slice(8);
  }

  function openEdit() {
    if (!data) return;
    setEditError("");
    setEditForm({
      name: data.name,
      mobile: data.mobile,
      date_of_birth: data.date_of_birth,
      village: data.village,
      taluka: data.taluka,
      district: data.district,
      income_source: data.income_source,
      cluster_type: data.cluster_type,
    });
  }

  async function handleEditSave() {
    if (!editForm) return;
    setActionLoading(true);
    setEditError("");
    try {
      const res = await fetch(`/api/admin/registrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", ...editForm }),
      });
      if (res.ok) {
        const refreshed = await fetch(`/api/admin/registrations/${id}`, { cache: "no-store" });
        if (refreshed.ok) setData(await refreshed.json());
        setEditForm(null);
      } else {
        const err = await res.json();
        setEditError(err.error || "Failed to update registration");
      }
    } catch {
      setEditError("Connection error");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete this registration? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/registrations/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/registrations");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete registration");
      }
    } catch {
      alert("Connection error");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <AdminShell>
      <div className="admin-detail-page">
        <Link href="/admin/registrations" className="admin-back-link">
          ← Back to Registrations
        </Link>

        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : !data ? (
          <div className="admin-empty">Registration not found</div>
        ) : (
          <>
            {/* Header */}
            <div className="admin-detail-header">
              <div>
                <h2 className="admin-detail-name">{data.name}</h2>
                <p className="admin-detail-meta">
                  Submitted {dateFormatter.format(new Date(data.created_at))} · via {data.source}
                </p>
              </div>
              <span className={`admin-badge admin-badge-lg admin-badge-${data.status}`}>
                {data.status}
              </span>
            </div>

            {/* Personal info */}
            <div className="admin-card">
              <h3 className="admin-card-title">Personal Details</h3>
              <div className="admin-detail-grid">
                <div className="admin-detail-field">
                  <span className="admin-detail-label">Full Name</span>
                  <span className="admin-detail-value">{data.name}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-label">Mobile</span>
                  <span className="admin-detail-value">{data.mobile}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-label">Date of Birth</span>
                  <span className="admin-detail-value">{data.date_of_birth}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-label">Aadhar</span>
                  <span className="admin-detail-value">{maskAadhar(data.aadhar_no)}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-label">Village</span>
                  <span className="admin-detail-value">{data.village}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-label">Taluka</span>
                  <span className="admin-detail-value capitalize">{data.taluka}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-label">District</span>
                  <span className="admin-detail-value">{data.district}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-label">Income Source</span>
                  <span className="admin-detail-value capitalize">{data.income_source}</span>
                </div>
                <div className="admin-detail-field">
                  <span className="admin-detail-label">Cluster Type</span>
                  <span className="admin-detail-value capitalize">{data.cluster_type}</span>
                </div>
              </div>
            </div>

            {/* Plots */}
            <div className="admin-card">
              <h3 className="admin-card-title">Farm Plots ({data.plots.length})</h3>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Plot / Survey No.</th>
                      <th>Area (Acres)</th>
                      <th>Crop</th>
                      <th>Irrigation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.plots.map((p, i) => (
                      <tr key={p.id}>
                        <td>{i + 1}</td>
                        <td>{p.plot_no}</td>
                        <td>{p.area_acres}</td>
                        <td>{p.crop_name}</td>
                        <td className="capitalize">{p.irrigation_source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Review notes (if reviewed) */}
            {data.reviewed_at && (
              <div className="admin-card">
                <h3 className="admin-card-title">Review Info</h3>
                <p>Reviewed on {dateFormatter.format(new Date(data.reviewed_at))}</p>
                {data.reviewer_notes && <p className="admin-notes">{data.reviewer_notes}</p>}
              </div>
            )}

            {/* Actions */}
            {data.status === "pending" && (
              <div className="admin-card admin-actions-card">
                {showConfirm ? (
                  <div className="admin-confirm-box">
                    <h3>
                      {showConfirm === "approve" ? "Approve this registration?" : "Reject this registration?"}
                    </h3>
                    <p className="admin-confirm-desc">
                      {showConfirm === "approve"
                        ? "This will create a verified farmer record from the registration data."
                        : "This will mark the registration as rejected. The data will be preserved."}
                    </p>
                    <textarea
                      placeholder="Optional notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="admin-textarea"
                      rows={3}
                    />
                    <div className="admin-confirm-actions">
                      <button
                        className="admin-btn admin-btn-outline"
                        onClick={() => { setShowConfirm(null); setNotes(""); }}
                        disabled={actionLoading}
                      >
                        Cancel
                      </button>
                      <button
                        className={`admin-btn ${showConfirm === "approve" ? "admin-btn-success" : "admin-btn-danger"}`}
                        onClick={() => handleAction(showConfirm)}
                        disabled={actionLoading}
                      >
                        {actionLoading ? "Processing..." : showConfirm === "approve" ? "Confirm Approve" : "Confirm Reject"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-action-buttons">
                    <button className="admin-btn admin-btn-success" onClick={() => setShowConfirm("approve")}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width={18} height={18}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Approve
                    </button>
                    <button className="admin-btn admin-btn-danger" onClick={() => setShowConfirm("reject")}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width={18} height={18}>
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Reject
                    </button>
                    <button className="admin-btn admin-btn-outline" onClick={openEdit}>Edit</button>
                  </div>
                )}
              </div>
            )}

            {/* Delete (non-approved registrations only) */}
            {data.status !== "approved" && (
              <div className="admin-card admin-actions-card">
                <div className="admin-action-buttons">
                  <button className="admin-btn admin-btn-danger" onClick={handleDelete} disabled={actionLoading}>
                    Delete Registration
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit modal */}
      {editForm && (
        <div className="admin-modal-overlay" onClick={() => setEditForm(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Registration</h2>

            <div className="admin-field">
              <label htmlFor="rg-name">Full Name</label>
              <input type="text" id="rg-name" value={editForm.name} onChange={(e) => setEditForm((s) => ({ ...s!, name: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="rg-mobile">Mobile</label>
              <input type="text" id="rg-mobile" value={editForm.mobile} onChange={(e) => setEditForm((s) => ({ ...s!, mobile: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="rg-dob">Date of Birth</label>
              <input type="date" id="rg-dob" value={editForm.date_of_birth} onChange={(e) => setEditForm((s) => ({ ...s!, date_of_birth: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="rg-village">Village</label>
              <input type="text" id="rg-village" value={editForm.village} onChange={(e) => setEditForm((s) => ({ ...s!, village: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="rg-taluka">Taluka</label>
              <select id="rg-taluka" className="admin-select" style={{ width: "100%" }} value={editForm.taluka} onChange={(e) => setEditForm((s) => ({ ...s!, taluka: e.target.value }))}>
                {TALUKA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="rg-district">District</label>
              <input type="text" id="rg-district" value={editForm.district} onChange={(e) => setEditForm((s) => ({ ...s!, district: e.target.value }))} />
            </div>
            <div className="admin-field">
              <label htmlFor="rg-income">Income Source</label>
              <select id="rg-income" className="admin-select" style={{ width: "100%" }} value={editForm.income_source} onChange={(e) => setEditForm((s) => ({ ...s!, income_source: e.target.value }))}>
                {INCOME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label htmlFor="rg-cluster">Cluster Type</label>
              <select id="rg-cluster" className="admin-select" style={{ width: "100%" }} value={editForm.cluster_type} onChange={(e) => setEditForm((s) => ({ ...s!, cluster_type: e.target.value }))}>
                {CLUSTER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {editError && <p className="admin-error">{editError}</p>}

            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-outline" onClick={() => setEditForm(null)} disabled={actionLoading}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleEditSave} disabled={actionLoading}>
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
