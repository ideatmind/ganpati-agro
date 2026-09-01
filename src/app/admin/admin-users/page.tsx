"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { PAGE_SIZE, type AdminUser } from "@/types/admin";

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric",
});

interface FormState {
  username: string;
  password: string;
  displayName: string;
  role: "admin" | "super_admin";
}

const EMPTY_FORM: FormState = { username: "", password: "", displayName: "", role: "admin" };

export default function AdminUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchUsers = useCallback(() => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
    fetch(`/api/admin/admin-users?${params}`, { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 403) { router.push("/admin"); return null; }
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data: { rows?: AdminUser[]; total?: number } | null) => {
        if (!data) return;
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Failed to fetch admin users", err);
      })
      .finally(() => setLoading(false));
  }, [page, router]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setShowCreate(true);
    setEditTarget(null);
  }

  function openEdit(user: AdminUser) {
    setForm({ username: user.username, password: "", displayName: user.display_name, role: user.role });
    setFormError("");
    setEditTarget(user);
    setShowCreate(false);
  }

  function closeModal() {
    setShowCreate(false);
    setEditTarget(null);
    setFormError("");
  }

  async function handleCreate() {
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, password: form.password, displayName: form.displayName, role: form.role }),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || "Failed to create account");
        return;
      }
      closeModal();
      fetchUsers();
    } catch {
      setFormError("Connection error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate() {
    if (!editTarget) return;
    setSaving(true);
    setFormError("");
    try {
      const body: Record<string, unknown> = { id: editTarget.id };
      if (form.displayName !== editTarget.display_name) body.displayName = form.displayName;
      if (form.role !== editTarget.role) body.role = form.role;
      if (form.password) body.password = form.password;

      const res = await fetch("/api/admin/admin-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || "Failed to update account");
        return;
      }
      closeModal();
      fetchUsers();
    } catch {
      setFormError("Connection error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: AdminUser) {
    if (!confirm(`${user.is_active ? "Deactivate" : "Reactivate"} ${user.display_name}?`)) return;
    try {
      const res = await fetch("/api/admin/admin-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, isActive: !user.is_active }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Action failed");
        return;
      }
      fetchUsers();
    } catch {
      alert("Connection error");
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AdminShell>
      <div className="admin-list-page">
        <div className="admin-filters">
          <button className="admin-btn admin-btn-primary" onClick={openCreate}>
            + Create Admin
          </button>
        </div>

        <div className="admin-results-info">
          {loading ? "Loading..." : `${total} admin account${total !== 1 ? "s" : ""}`}
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Display Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr><td colSpan={6} className="admin-empty">No admin accounts</td></tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id}>
                    <td className="admin-td-name">{u.username}</td>
                    <td>{u.display_name}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${u.role}`}>
                        {u.role === "super_admin" ? "Super Admin" : "Admin"}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge admin-badge-${u.is_active ? "active" : "inactive"}`}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="admin-td-date">{dateFormatter.format(new Date(u.created_at))}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="admin-btn admin-btn-outline admin-btn-sm" onClick={() => openEdit(u)}>
                          Edit
                        </button>
                        <button
                          className={`admin-btn admin-btn-sm ${u.is_active ? "admin-btn-danger" : "admin-btn-success"}`}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
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

      {/* Create / Edit Modal */}
      {(showCreate || editTarget) && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editTarget ? `Edit ${editTarget.display_name}` : "Create Admin Account"}</h2>

            {!editTarget && (
              <div className="admin-field">
                <label htmlFor="adm-username">Username</label>
                <input
                  type="text" id="adm-username" value={form.username}
                  onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                  placeholder="e.g. priya.patil" autoComplete="off"
                />
              </div>
            )}

            <div className="admin-field">
              <label htmlFor="adm-displayname">Display Name</label>
              <input
                type="text" id="adm-displayname" value={form.displayName}
                onChange={(e) => setForm((s) => ({ ...s, displayName: e.target.value }))}
                placeholder="Full name" autoComplete="off"
              />
            </div>

            <div className="admin-field">
              <label htmlFor="adm-password">{editTarget ? "New Password (leave blank to keep)" : "Password"}</label>
              <input
                type="password" id="adm-password" value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                placeholder={editTarget ? "Leave blank to keep current" : "Min 3 characters"}
                autoComplete="new-password"
              />
            </div>

            <div className="admin-field">
              <label htmlFor="adm-role">Role</label>
              <select
                id="adm-role" className="admin-select"
                value={form.role}
                onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as "admin" | "super_admin" }))}
                style={{ width: "100%" }}
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            {formError && <p className="admin-error">{formError}</p>}

            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-outline" onClick={closeModal} disabled={saving}>Cancel</button>
              <button
                className="admin-btn admin-btn-primary"
                onClick={editTarget ? handleUpdate : handleCreate}
                disabled={saving}
              >
                {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
