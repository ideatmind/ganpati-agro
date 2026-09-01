"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import Link from "next/link";
import { type DashboardStats, type AuditLogEntry } from "@/types/admin";
import { TALUKA_LABELS } from "@/lib/constants";

type Stats = DashboardStats;

interface SessionIdentity {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "super_admin";
}

const activityDateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});

function humanizeAction(action: string): string {
  return action.replace(/_/g, " ");
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<AuditLogEntry[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/stats", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to fetch dashboard stats");
        return response.json() as Promise<Stats>;
      })
      .then(setStats)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Failed to fetch dashboard stats", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/session", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("session unavailable");
        return res.json() as Promise<SessionIdentity>;
      })
      .then((identity) => {
        if (identity.role !== "super_admin") return null;
        return fetch("/api/admin/activity?limit=5", { signal: controller.signal, cache: "no-store" });
      })
      .then((res) => {
        if (!res) return null;
        if (!res.ok) throw new Error("Failed to fetch activity");
        return res.json() as Promise<{ rows?: AuditLogEntry[] }>;
      })
      .then((data) => {
        if (data?.rows) setActivity(data.rows);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  const total = stats
    ? Object.values(stats.registrations).reduce((a, b) => a + b, 0)
    : 0;
  const pending = stats?.registrations?.pending ?? 0;
  const approved = stats?.registrations?.approved ?? 0;
  const rejected = stats?.registrations?.rejected ?? 0;

  return (
    <AdminShell>
      <div className="admin-dashboard">
        {loading ? (
          <div className="admin-loading">Loading dashboard...</div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="admin-stat-icon total">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={24} height={24}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{total}</span>
                  <span className="admin-stat-label">Total Registrations</span>
                </div>
              </div>

              <Link href="/admin/registrations?status=pending" className="admin-stat-card clickable">
                <div className="admin-stat-icon pending">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={24} height={24}>
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{pending}</span>
                  <span className="admin-stat-label">Pending Review</span>
                </div>
              </Link>

              <div className="admin-stat-card">
                <div className="admin-stat-icon approved">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={24} height={24}>
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{approved}</span>
                  <span className="admin-stat-label">Approved</span>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-icon rejected">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={24} height={24}>
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{rejected}</span>
                  <span className="admin-stat-label">Rejected</span>
                </div>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-icon farmers">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={24} height={24}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <div className="admin-stat-info">
                  <span className="admin-stat-value">{stats?.total_farmers ?? 0}</span>
                  <span className="admin-stat-label">Verified Farmers</span>
                </div>
              </div>
            </div>

            {/* Taluka breakdown */}
            {stats?.by_taluka && Object.keys(stats.by_taluka).length > 0 && (
              <div className="admin-card">
                <h2 className="admin-card-title">Registrations by Taluka</h2>
                <div className="admin-taluka-grid">
                  {Object.entries(stats.by_taluka)
                    .sort(([, a], [, b]) => b - a)
                    .map(([taluka, count]) => (
                      <div key={taluka} className="admin-taluka-item">
                        <span className="admin-taluka-name">{TALUKA_LABELS[taluka] || taluka}</span>
                        <div className="admin-taluka-bar-wrap">
                          <div
                            className="admin-taluka-bar"
                            style={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="admin-taluka-count">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent activity (super_admin only) */}
            {activity && activity.length > 0 && (
              <div className="admin-card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 className="admin-card-title">Recent Activity</h2>
                  <Link href="/admin/activity" className="admin-back-link" style={{ marginBottom: 0 }}>
                    View all →
                  </Link>
                </div>
                <div className="admin-activity-feed">
                  {activity.map((entry) => (
                    <div key={entry.id} className="admin-activity-row">
                      <span className={`admin-badge admin-badge-${entry.action.includes("fail") ? "rejected" : entry.action === "login" ? "pending" : "approved"}`}>
                        {humanizeAction(entry.action)}
                      </span>
                      <span className="admin-activity-text">
                        <strong>{entry.admin_username}</strong>
                        {entry.target_table ? ` · ${entry.target_table.replace(/_/g, " ")}` : ""}
                      </span>
                      <span className="admin-td-date">
                        {activityDateFormatter.format(new Date(entry.created_at))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick actions */}
            <div className="admin-card">
              <h2 className="admin-card-title">Quick Actions</h2>
              <div className="admin-quick-actions">
                <Link href="/admin/registrations?status=pending" className="admin-btn admin-btn-primary">
                  Review Pending ({pending})
                </Link>
                <a href="/api/admin/export?type=registrations" className="admin-btn admin-btn-outline" download>
                  Export Registrations CSV
                </a>
                <a href="/api/admin/export?type=farmers" className="admin-btn admin-btn-outline" download>
                  Export Farmers CSV
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
