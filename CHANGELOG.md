# Changelog

## Multi-Admin System, Audit Trail & Dashboard Overhaul

### New Features
- **Multi-admin accounts** with `super_admin` and `admin` roles via `admin_users` table and pgcrypto bcrypt password hashing
- **Audit trail** (`admin_audit_log` table) records every mutating admin action (approve, reject, edit, delete, login, login_failed, create/edit/deactivate admin, password reset) atomically in the same RPC transaction
- **Activity Log page** (`/admin/activity`) — super_admin-only, filterable by admin username, action type, and date range; paginated
- **Admin Users management page** (`/admin/admin-users`) — super_admin-only, create/edit/deactivate accounts, reset passwords
- **Farmer management** — edit and delete farmers from the Farmers list (new `admin_edit_farmer` / `admin_delete_farmer` RPCs + API)
- **Registration management** — edit and delete pending/rejected registrations (new `admin_edit_registration` / `admin_delete_registration` RPCs + API)
- **Session identity display** — header shows admin name + role badge, sidebar shows role-gated navigation
- **Per-IP/per-username login rate limiting** with expired-entry eviction (replaces old unbounded-growth rate limiter)
- **Seed script** (`docs/admin-users-seed.sql`) creates 1 super_admin + 4 admin accounts with bcrypt-hashed passwords

### Security Fixes (from prior audit)
- **`ADMIN_SESSION_SECRET` is now required** — fails loudly if missing; no fallback to admin password
- **Timing-safe HMAC verification** — uses `crypto.subtle.verify()` instead of JavaScript string comparison
- **Removed shared `ADMIN_PASSWORD`** — the old single-password auth path is fully deleted
- **Login rate limiting** added to `/api/admin/login` (5/min per username, 30/min per IP)
- **Authorization on every route** — `requireAdmin(request, role)` checks role; 401 for unauthenticated, 403 for insufficient role
- **Inactive admin enforcement** — `requireAdmin()` re-checks accounts via `admin_verify_session()` and every database RPC calls `admin_require()` (both check `is_active = true`), so a deactivated admin cannot keep using an unexpired cookie
- **Fixed dead proxy API protection** — the proxy's `/api/admin/*` 401 path was unreachable because of an early return; it now guards both pages and API routes
- **Duplicate farm_plots on re-approval fixed** — `DELETE FROM farm_plots WHERE farmer_id = ...` before re-inserting

### Code Cleanup
- **Centralized `TALUKA_OPTIONS`** — extracted to `src/lib/constants.ts`, imported everywhere (was duplicated in 4 files)
- **Fixed `revalidateTag` calls** — migrated to the two-argument `revalidateTag(tag, "max")` form required by Next.js 16 (the single-argument form is deprecated in this version)
- **Deleted `public/card-layout.png`** — unused (only `.svg` was referenced in CSS)
- **Split admin CSS** — admin-only styles moved from `globals.css` to `src/app/admin/admin.css`, loaded only on `/admin/*` routes via admin layout
- **Removed `ADMIN_PASSWORD` from `.env.local`** — replaced with `ADMIN_SESSION_SECRET`
- **Surfaced RPC error messages** — `callRpc` now includes the PostgREST error message in thrown errors so admin actions can show meaningful failures

### New Files
| File | Purpose |
| --- | --- |
| `src/components/admin/AdminShell.tsx` | Sidebar + header shell with session, role-gated nav, logout |
| `src/app/admin/admin.css` | Admin-only styles (extracted from globals.css) |
| `src/app/admin/activity/page.tsx` | Activity Log page (super_admin only) |
| `src/app/admin/admin-users/page.tsx` | Admin Users management page (super_admin only) |
| `src/app/api/admin/session/route.ts` | Session identity endpoint |
| `src/app/api/admin/activity/route.ts` | Audit log list endpoint (super_admin only) |
| `src/app/api/admin/admin-users/route.ts` | Admin user CRUD endpoint (super_admin only) |
| `src/app/api/admin/farmers/[id]/route.ts` | Farmer edit/delete endpoint |
| `src/lib/admin-request.ts` | Shared `requireAdmin()`, pagination, search helpers |
| `src/lib/admin-cache.ts` | Cache tag constants |
| `src/lib/rate-limit.ts` | Rate limiter with expired-entry eviction |
| `src/lib/constants.ts` | Centralized TALUKA_OPTIONS, TALUKA_LABELS, TALUKA_VALUES |
| `src/hooks/useDebounce.ts` | Debounce hook for search inputs |
| `src/types/admin.ts` | Shared TypeScript types for admin dashboard |
| `docs/admin-accounts-audit-migration.sql` | Migration: admin_users, admin_audit_log, updated RPCs |
| `docs/admin-users-seed.sql` | Seed: 5 admin accounts with bcrypt hashes |
| `docs/PERMISSIONS.md` | Route → role permission matrix |

### Modified Files
| File | Change |
| --- | --- |
| `src/lib/admin-auth.ts` | Rewritten: multi-admin identity, required secret, timing-safe HMAC |
| `src/proxy.ts` | Fixed API-protection dead code; attaches admin identity headers |
| `src/lib/admin-request.ts` | `requireAdmin()` now re-checks `admin_verify_session()` for `is_active` |
| `src/lib/supabase.ts` | Surfaced RPC error messages from PostgREST responses |
| `src/app/api/admin/login/route.ts` | Username/password login, per-IP + per-username rate limiting |
| `src/app/api/admin/stats/route.ts` | Added `p_admin_id`, authorization check |
| `src/app/api/admin/registrations/route.ts` | Added `p_admin_id`, authorization check |
| `src/app/api/admin/registrations/[id]/route.ts` | Added `p_admin_id`, edit/delete actions, fixed `revalidateTag` |
| `src/app/api/admin/farmers/route.ts` | Added `p_admin_id`, authorization check |
| `src/app/api/admin/export/route.ts` | Added `p_admin_id`, authorization check |
| `src/app/api/registration/route.ts` | Uses shared constants, fixed `revalidateTag`, shared rate limiter |
| `src/app/admin/layout.tsx` | Imports `admin.css` |
| `src/app/admin/page.tsx` | Uses AdminShell, centralized constants |
| `src/app/admin/registrations/page.tsx` | Uses AdminShell, centralized constants |
| `src/app/admin/registrations/[id]/page.tsx` | Uses AdminShell; added edit + delete actions |
| `src/app/admin/farmers/page.tsx` | Uses AdminShell; added edit + delete actions |
| `src/app/admin/activity/page.tsx` | Added date-range filters |
| `src/app/admin/login/page.tsx` | Username + password form |
| `src/components/RegistrationForm/RegistrationForm.tsx` | Imports TALUKA_OPTIONS from constants |
| `src/app/globals.css` | Removed admin CSS (moved to admin.css) |
| `.env.local` | Removed `ADMIN_PASSWORD`, added `ADMIN_SESSION_SECRET` |

### Deleted Files
| File | Reason |
| --- | --- |
| `public/card-layout.png` | Unused — only `card-layout.svg` is referenced |

### Intentionally Retained
- **`hero-bg.mp4` (3.8 MB)** — large but functional; compression is a content task, not a code change
- **`logo-icon.png` (1.2 MB)** — should be optimized but requires design input on target sizes
- **CSP `unsafe-eval`** — may be required by Next.js; needs careful testing before removal
- **`improve.txt`** — requirements document, not code; retained for reference
