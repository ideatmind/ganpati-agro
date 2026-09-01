"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface AdminIdentity {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "super_admin";
}

interface NavItem {
  href: string;
  label: string;
  icon: string;
  superOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/registrations", label: "Registrations", icon: "registrations" },
  { href: "/admin/farmers", label: "Farmers", icon: "farmers" },
  { href: "/admin/activity", label: "Activity Log", icon: "activity", superOnly: true },
  { href: "/admin/admin-users", label: "Admin Users", icon: "users", superOnly: true },
];

const icons: Record<string, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={20} height={20}>
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  registrations: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={20} height={20}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  farmers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={20} height={20}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={20} height={20}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={20} height={20}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
};

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [identity, setIdentity] = useState<AdminIdentity | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/session", { signal: controller.signal, cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          // Expired, invalid, or deactivated session — send the user to login.
          if (res.status === 401 || res.status === 403) {
            router.replace("/admin/login");
            return;
          }
          throw new Error("session check failed");
        }
        return res.json() as Promise<AdminIdentity>;
      })
      .then((value) => {
        if (value) setIdentity(value);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [router]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.push("/admin/login");
  }, [router]);

  const isSuper = identity?.role === "super_admin";

  return (
    <div className="admin-shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="admin-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`admin-sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width={28} height={28}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
            </svg>
            Ganpati Agro
          </div>
        </div>
        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => {
            if (item.superOnly && !isSuper) return null;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-nav-item${isActive ? " active" : ""}`}
                onClick={() => setSidebarOpen(false)}
              >
                {icons[item.icon]}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-footer">
          <button className="admin-nav-item admin-logout-btn" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={20} height={20}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="admin-main">
        <header className="admin-topbar">
          <button className="admin-hamburger" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width={24} height={24}>
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="admin-page-title">
            {NAV_ITEMS.find(
              (it) =>
                it.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(it.href)
            )?.label ?? "Admin"}
          </h1>
          <div className="admin-topbar-right">
            {identity && (
              <>
                <span className={`admin-badge admin-badge-${identity.role === "super_admin" ? "approved" : "pending"}`}>
                  {identity.role === "super_admin" ? "Super Admin" : "Admin"}
                </span>
                <span className="admin-topbar-name">{identity.displayName}</span>
              </>
            )}
          </div>
        </header>
        <div className="admin-content">
          {children}
        </div>
      </main>
    </div>
  );
}
