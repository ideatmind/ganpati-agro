"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import AdminShell from "@/components/admin/AdminShell";
import Link from "next/link";

interface Plot {
  id: string;
  plot_no: string;
  area_acres: number;
  crop_name: string;
  irrigation_source: string;
}

interface RegistrationDetail {
  id: string;
  request_id: string;
  name: string;
  mobile: string;
  date_of_birth: string;
  aadhar_no: string;
  village: string;
  taluka: string;
  district: string;
  income_source: string;
  cluster_type: string;
  consent_given: boolean;
  status: string;
  source: string;
  created_at: string;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  plots: Plot[];
}

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

  useEffect(() => {
    fetch(`/api/admin/registrations/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
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
        // Refetch to show updated status
        const updated = await fetch(`/api/admin/registrations/${id}`).then((r) => r.json());
        setData(updated);
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

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  function maskAadhar(aadhar: string) {
    if (aadhar.length !== 12) return aadhar;
    return "••••-••••-" + aadhar.slice(8);
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
                  Submitted {formatDate(data.created_at)} · via {data.source}
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
                <p>Reviewed on {formatDate(data.reviewed_at)}</p>
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
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}
