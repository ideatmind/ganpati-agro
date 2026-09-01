# Admin Route Permissions

All admin routes require a valid signed session cookie. The Proxy (`src/proxy.ts`) performs an optimistic session check and passes identity headers. Each API route independently verifies the signed cookie via `requireAdmin()` from `src/lib/admin-request.ts`. Database RPCs additionally reject inactive accounts and enforce super-admin operations via `admin_require()`.

## API Routes

| Route | Method | Required Role | Description |
| --- | --- | --- | --- |
| `/api/admin/login` | POST | _public_ | Authenticate with username + password |
| `/api/admin/login` | DELETE | _any admin_ | Clear session cookie (logout) |
| `/api/admin/session` | GET | `admin` or `super_admin` | Return current session identity |
| `/api/admin/stats` | GET | `admin` or `super_admin` | Dashboard aggregate statistics |
| `/api/admin/registrations` | GET | `admin` or `super_admin` | Paginated registration list |
| `/api/admin/registrations/[id]` | GET | `admin` or `super_admin` | Single registration with plots |
| `/api/admin/registrations/[id]` | PATCH | `admin` or `super_admin` | Approve, reject, or edit a registration |
| `/api/admin/registrations/[id]` | DELETE | `admin` or `super_admin` | Delete a pending/rejected registration |
| `/api/admin/farmers` | GET | `admin` or `super_admin` | Paginated farmer list |
| `/api/admin/farmers/[id]` | PATCH | `admin` or `super_admin` | Edit a farmer record |
| `/api/admin/farmers/[id]` | DELETE | `admin` or `super_admin` | Delete a farmer record |
| `/api/admin/export` | GET | `admin` or `super_admin` | CSV export (registrations or farmers) |
| `/api/admin/activity` | GET | `super_admin` only | Filtered, paginated audit log |
| `/api/admin/admin-users` | GET | `super_admin` only | List admin accounts |
| `/api/admin/admin-users` | POST | `super_admin` only | Create admin account |
| `/api/admin/admin-users` | PATCH | `super_admin` only | Edit/deactivate/reset password |

## Page Routes

| Route | Access | Notes |
| --- | --- | --- |
| `/admin/login` | _public_ | Login page (not session-gated) |
| `/admin` | `admin` or `super_admin` | Dashboard home |
| `/admin/registrations` | `admin` or `super_admin` | Registration list |
| `/admin/registrations/[id]` | `admin` or `super_admin` | Registration detail + actions |
| `/admin/farmers` | `admin` or `super_admin` | Farmer list |
| `/admin/activity` | `super_admin` only | Activity log (hidden from nav for admins, 403 from API) |
| `/admin/admin-users` | `super_admin` only | Admin user management (hidden from nav for admins, 403 from API) |

## Enforcement Layers

1. **Proxy (middleware):** Redirects unauthenticated page visits to `/admin/login`; returns 401 for unauthenticated API calls, and attaches identity headers to authenticated requests.
2. **`requireAdmin(request, role)`:** Each route handler verifies the cookie independently and re-checks the account via `admin_verify_session()` (which enforces `is_active = true`) before checking role (returns 401 or 403).
3. **Database RPCs:** Every RPC calls `admin_require(p_admin_id)` which verifies the admin exists and `is_active = true`. Super-admin operations pass `admin_require(p_admin_id, true)`.
4. **UI:** Super-admin-only nav items are hidden for regular admins. This is a UX convenience — the actual enforcement is server-side.
